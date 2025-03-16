require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { createClient } = require('@deepgram/sdk');
const { OpenAI } = require('openai');
const twilio = require('twilio');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const TO_PHONE_NUMBER = process.env.TO_PHONE_NUMBER;

const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// ✅ Add `wss://` directly in code
const TWILIO_URL = `wss://${process.env.NGROK_URL}/twilio`;

let conversationMemory = []; // ✅ Conversation Memory Array
const MAX_MEMORY_LENGTH = 10; // ✅ Limit to last 10 exchanges

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.post('/twilio', (req, res) => {
  console.log('📞 Incoming call...');

  // ✅ Reset memory at the start of each call
  conversationMemory = [
    { role: "system", content: "You are a helpful and engaging AI assistant." }
  ];

  const response = `
    <Response>
      <Say>Connecting you to the AI assistant...</Say>
      <Connect>
        <Stream url="${TWILIO_URL}"
                track="inbound_track"
                startOnDialAnswer="true"
                encoding="mulaw"
                sampleRate="8000" />
      </Connect>
      <Say>The AI assistant is now listening.</Say>
    </Response>
  `;

  console.log('✅ Sending TwiML response to Twilio');
  res.set('Content-Type', 'text/xml');
  res.send(response);
});

wss.on('connection', (ws) => {
  console.log('✅ Twilio WebSocket connected — Attempting to open Deepgram connection...');

  let streamSid = null;
  let deepgramSocket = null;

  function connectToDeepgram() {
    if (deepgramSocket && deepgramSocket.readyState === WebSocket.OPEN) {
      deepgramSocket.requestClose();
    }

    console.log('🌐 Connecting to Deepgram...');
    deepgramSocket = deepgram.listen.live({
      model: 'general',
      encoding: 'mulaw',
      sample_rate: 8000,
      channels: 1,
      punctuate: true,
      interim_results: true,
      vad_events: true,
      smart_formatting: true,
      filter_profanity: true,
      end_delay: 1000,
      debug: true
    });

    deepgramSocket.on('open', () => {
      console.log('✅ Deepgram WebSocket connected');
    });

    deepgramSocket.on('transcriptReceived', async (data) => {
      const transcript = data.channel.alternatives[0]?.transcript;
      if (transcript) {
        console.log(`📝 Transcribed: ${transcript}`);
        const aiResponse = await getAIResponse(transcript);
        console.log(`🤖 AI Response: ${aiResponse}`);
        await sendToTwilio(aiResponse);
      }
    });

    deepgramSocket.on('error', (err) => {
      console.error('❌ Deepgram connection error:', JSON.stringify(err, null, 2));
      console.warn('⚠️ Attempting to reconnect to Deepgram...');
      setTimeout(connectToDeepgram, 2000);
    });

    deepgramSocket.on('close', (event) => {
      console.log(`❌ Deepgram WebSocket closed. Code: ${event.code}, Reason: ${event.reason || 'No reason provided'}`);
    });
  }

  connectToDeepgram();

  const keepAliveInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN && streamSid) {
      ws.send(
        JSON.stringify({
          event: 'media',
          streamSid: streamSid,
          media: {
            payload: Buffer.alloc(160).toString('base64'),
          },
        })
      );
      console.log('🔄 Sent silent frame to keep Twilio alive');
    }
  }, 1000);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      if (data.event === 'start') {
        streamSid = data.start.streamSid;
        console.log(`✅ Stream started: ${streamSid}`);
      } else if (data.event === 'media') {
        const audioFrame = Buffer.from(data.media.payload, 'base64');
        console.log(`🎧 Received audio frame (${audioFrame.length} bytes)`);

        if (deepgramSocket && deepgramSocket.readyState === WebSocket.OPEN) {
          deepgramSocket.send(audioFrame);
        }
      } else if (data.event === 'stop') {
        console.log(`❌ Stream ended: ${data.streamSid}`);
        if (deepgramSocket && deepgramSocket.readyState === WebSocket.OPEN) {
          deepgramSocket.requestClose();
        }
        clearInterval(keepAliveInterval);
      }
    } catch (err) {
      console.error('❌ Error processing Twilio message:', err.message);
    }
  });

  ws.on('close', (code, reason) => {
    console.log(`❌ Twilio WebSocket closed. Code: ${code}, Reason: ${reason || 'No reason provided'}`);
    if (deepgramSocket && deepgramSocket.readyState === WebSocket.OPEN) {
      deepgramSocket.requestClose();
    }
    clearInterval(keepAliveInterval);
  });
});

// ✅ Generate AI Response Using OpenAI with Memory
const getAIResponse = async (transcript) => {
  try {
    console.log(`🧠 Updating memory with user input: ${transcript}`);

    // ✅ Add user message to memory
    conversationMemory.push({ role: 'user', content: transcript });

    // ✅ Keep only last 10 messages
    if (conversationMemory.length > MAX_MEMORY_LENGTH) {
      conversationMemory.shift();
    }

    // ✅ Send full memory to OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: conversationMemory,
      max_tokens: 100
    });

    const aiResponse = completion.choices[0]?.message?.content?.trim();

    // ✅ Add AI response to memory
    if (aiResponse) {
      conversationMemory.push({ role: 'assistant', content: aiResponse });
    }

    return aiResponse || 'Sorry, I didn’t catch that.';
  } catch (error) {
    console.error(`❌ OpenAI Error: ${error.message}`);
    return 'Sorry, I couldn’t understand that.';
  }
};

// ✅ Send AI Response to Twilio
const sendToTwilio = async (message) => {
  try {
    console.log(`📤 Sending to Twilio: ${message}`);
    const call = await twilioClient.calls.create({
      twiml: `<Response><Say>${message}</Say></Response>`,
      to: TO_PHONE_NUMBER,
      from: TWILIO_PHONE_NUMBER
    });
    console.log(`✅ TTS response sent to Twilio: Call SID = ${call.sid}`);
  } catch (error) {
    console.error('❌ Error sending message to Twilio:', error);
  }
};

server.listen(3000, () => console.log('🚀 Server running on port 3000'));
