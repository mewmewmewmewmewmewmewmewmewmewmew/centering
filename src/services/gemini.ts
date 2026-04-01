// v2.6 - Gemini Service Refinements
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function detectCardCorners(base64Image: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image.split(",")[1],
            },
          },
          {
            text: "Detect the 4 corners of the trading card in this image. Return the coordinates as normalized values (0-1000) for [top-left, top-right, bottom-right, bottom-left]. Provide only the JSON.",
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          corners: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER },
              },
              required: ["x", "y"],
            },
            minItems: 4,
            maxItems: 4,
          },
        },
        required: ["corners"],
      },
    },
  });

  try {
    const data = JSON.parse(response.text);
    return data.corners;
  } catch (e) {
    console.error("Failed to parse AI response", e);
    return null;
  }
}

export async function analyzeCentering(base64Image: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image.split(",")[1],
            },
          },
          {
            text: "Analyze the centering of this trading card. Estimate the Left/Right and Top/Bottom ratios as percentages (e.g., 50/50, 60/40). Also provide a brief explanation of the border widths.",
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          leftRightRatio: { type: Type.STRING },
          topBottomRatio: { type: Type.STRING },
          explanation: { type: Type.STRING },
        },
        required: ["leftRightRatio", "topBottomRatio", "explanation"],
      },
    },
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    console.error("Failed to parse AI response", e);
    return null;
  }
}
