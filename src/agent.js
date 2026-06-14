'use strict';

let _projectClient = null;

function getProjectClient() {
  if (_projectClient) return _projectClient;
  const { AIProjectClient } = require('@azure/ai-projects');
  const { DefaultAzureCredential } = require('@azure/identity');
  _projectClient = new AIProjectClient(
    process.env.AZURE_AGENT_ENDPOINT,
    new DefaultAzureCredential()
  );
  return _projectClient;
}

async function callAgent(userMessage) {
  const projectClient = getProjectClient();
  const openAIClient = projectClient.getOpenAIClient();
  const conversation = await openAIClient.conversations.create({
    items: [{ type: 'message', role: 'user', content: userMessage }],
  });
  const response = await openAIClient.responses.create(
    { conversation: conversation.id },
    {
      body: {
        agent: {
          name: process.env.AZURE_AGENT_NAME,
          version: process.env.AZURE_AGENT_VERSION || '3',
          type: 'agent_reference',
        },
      },
    }
  );
  return response.output_text;
}

module.exports = { callAgent };
