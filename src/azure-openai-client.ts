// Azure OpenAI client for intelligent summarization
export class AzureOpenAIClient {
  private endpoint: string;
  private apiKey: string;
  private deploymentName: string;
  private apiVersion = "2024-08-01-preview";

  constructor(endpoint: string, apiKey: string, deploymentName: string = "gpt-4o-mini") {
    this.endpoint = endpoint.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = apiKey;
    this.deploymentName = deploymentName;
  }

  async summarize(content: string, maxTokens: number = 500): Promise<string> {
    const url = `${this.endpoint}/openai/deployments/${this.deploymentName}/chat/completions?api-version=${this.apiVersion}`;
    
    const systemPrompt = `You are a technical documentation summarizer. Summarize the following content concisely, preserving key technical details, structure, and important values. Focus on:
1. Main purpose/functionality
2. Key configuration or settings
3. Important errors or issues
4. Critical data points or metrics
Keep the summary structured and easy to scan.`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Summarize this technical content:\n\n${content.substring(0, 50000)}` }
        ],
        max_tokens: maxTokens,
        temperature: 0.3,
        top_p: 0.95,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Azure OpenAI API error (${response.status}): ${errorText}`);
      // Return original content if summarization fails
      return content;
    }

    interface ChatMessage { content?: string }
    interface ChatChoice { message?: ChatMessage }
    interface ChatCompletionsResponse { choices?: ChatChoice[] }
    const result = (await response.json()) as ChatCompletionsResponse;
    return result.choices?.[0]?.message?.content || content;
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Skip availability check for now - assume it's available if configured
      return true;
    } catch {
      return false;
    }
  }
}
