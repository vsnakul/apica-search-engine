// mockData.js
export const generateMockData = (count) => {
    return Array.from({ length: count }, (_, i) => ({
      id: `msg-${i + 1}`,
      title: `Message ${i + 1}`,
      preview: `This is a preview of message ${i + 1}`,
      content: `This is the full content of message ${i + 1}. It contains more detailed information that is only shown when the message is expanded. This would typically include the full message body, timestamps, sender information, and other relevant details.`,
      timestamp: new Date(Date.now() - i * 3600000).toISOString(),
      sender: `user${i % 5 + 1}@example.com`
    }));
  };