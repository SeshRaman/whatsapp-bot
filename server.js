const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const twilio = require('twilio');
var request = require('request');
const axios = require('axios');


let conversationId = '1r6jizmmZxN3r2hLX2W9Bp-in';
const directLineToken = 'yzZJrsU3OUA.V99G5UCiB9R00kGx2tZaWHFGXCwjQGbr_STSOXIgupI';  // Use the Direct Line Token you have
const accountSid = 'ACb1bb9c97453b06f952e5051c43d69f5b';
const authToken = '20ae11fb1f3d13c9fe98010bffcc81d1';
const client = twilio(accountSid, authToken);

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

// Start a conversation with the bot using the Direct Line API
async function startConversation() {
    console.log("conversation starting")
    const response = await fetch('https://directline.botframework.com/v3/directline/conversations', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${directLineToken}`,
            'Content-Type': 'application/json',
        },
    });
    const data = await response.json();
    return data.conversationId;
}

// Send a message to the bot


async function sendMessage(conversationId, messageText) {
    console.log("sending message to the bot", conversationId)
    let data = JSON.stringify({
        "locale": "en-EN",
        "type": "message",
        "from": {
            "id": "whatsapp_user"
        },
        "text": messageText
    });

    let config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `https://directline.botframework.com//v3/directline/conversations/${conversationId}/activities`,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${directLineToken}`
        },
        data: data
    };

    const value = axios.request(config)
        .then((response) => {
            console.log("response from activity", JSON.stringify(response.data));
            return response.data
        })
        .catch((error) => {
            console.log(error);
        });

    return value

}

// Poll bot responses after sending the message
async function getBotResponses(conversationId) {
    console.log("getting message from the bot converstation id : ", conversationId)
    const response = await fetch(`https://directline.botframework.com/v3/directline/conversations/${conversationId}/activities`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${directLineToken}`,
            'Content-Type': 'application/json',
        },
    });
    const data = await response.json();
    return data.activities;
}

async function checkConversationStatus(conversationId, directLineToken) {
    const url = `https://directline.botframework.com/v3/directline/conversations/${conversationId}/activities`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${directLineToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            type: 'message',
            from: { id: 'whatsapp_user' },
            text: 'Test message to check conversation status'
        })
    });

    if (response.ok) {
        console.log('Conversation is still active.');
        return true
    } else {
        const errorData = await response.json();
        console.error('Conversation is no longer active. Error:', errorData);
        return false
    }
}

// Example usage with a conversation ID and Direct Line token


// Webhook to handle incoming WhatsApp messages via Twilio
app.post('/whatsapp', async (req, res) => {
    const incomingMessage = req.body.Body;  // Message sent by the user via WhatsApp
    const userNumber = req.body.From;    
    console.log("sample 3", incomingMessage, userNumber);
    // WhatsApp user's number

    let conversationIdNew = null

    // let isConversationActive = await checkConversationStatus(conversationId, directLineToken)

    console.log("conversation active :", conversationId)

    // if (isConversationActive) {
    //     conversationIdNew = conversationId
    //     console.log("use existing")
    // } else {
    //     conversationIdNew = await startConversation();
    //     console.log("use new")
    // }

    conversationIdNew = conversationId

    conversationIdNew = await startConversation();

    console.log("conversation id new:", conversationIdNew)

    // Send the user's WhatsApp message to the bot
    const conversationIdDetail = await sendMessage(conversationIdNew, incomingMessage);

    console.log("conversation_detail:", conversationIdDetail?.id)


    // Poll for the bot's response
    setTimeout(async () => {
        const activities = await getBotResponses(conversationIdNew);
        // console.log("activities", activities);
        const botResponses = activities.filter(activity => activity.replyToId === conversationIdDetail?.id); // Filter out user messages
        console.log("botResponse", botResponses, botResponses.length);
        if (botResponses.length > 0) {
            let botReply = botResponses[botResponses.length - 1]
            console.log("botReply intermediate : ", botReply)
            if (botReply?.text) {
                console.log("botReply condition 1 : ", botReply)
                botReply = botReply?.text
            } else if (botReply?.attachments) {
                // botReply = botReply?.attachments?.[0]?.content?.body?.[1]?.text
                botReply = JSON.stringify(botReply?.attachments?.[0]?.content?.body) ? JSON.stringify(botReply?.attachments?.[0]?.content?.body) : "wrong data format"
                console.log("botReply condition 2 : ", botReply)

            } else {
                console.log("botReply condition 3 : ", botReply)
                botReply = "No response found"
            }
            // Send the bot's reply back to the user on WhatsApp
            console.log("botReply : ", botReply)
            client.messages.create({
                from: 'whatsapp:+14155238886', // Twilio sandbox or approved WhatsApp number
                to: userNumber,                // User's WhatsApp number
                body: botReply
            }).then(message => console.log(`Message sent with SID: ${message.sid}`));
        }
    }, 15000); // Poll after 15 seconds to allow bot processing

    res.sendStatus(200);  // Respond to Twilio to acknowledge receipt
});


app.get('/', (req, res) => {
    res.sendStatus(200);
})
// Start the Express server on port 3000
app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
