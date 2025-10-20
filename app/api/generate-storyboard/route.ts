import { NextResponse } from "next/server"
import { generateText } from "ai"

export async function POST(req: Request) {
  try {
    const { prompt, style, referenceImageUrl } = await req.json()

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
    }

    const stylePersonality = {
      luxury: `Luxury aesthetic: Premium, elegant, sophisticated. High-end materials, perfect lighting, smooth camera movements.`,
      minimal: `Minimal aesthetic: Clean, simple, zen-like. Soft lighting, deliberate movements, negative space.`,
      retro: `1960s Retro aesthetic: Warm vintage colors, film grain, nostalgic feel, period-appropriate elements.`,
      cinematic: `Cinematic aesthetic: Epic, dramatic, film-like. High contrast, anamorphic lens flares, emotional storytelling.`,
      "fast-cut": `Fast-cut aesthetic: Rapid editing, multiple angles, explosive energy, vibrant colors, TikTok/Reels style.`,
      lifestyle: `Lifestyle aesthetic: Authentic, relatable, natural lighting, real people in real moments.`,
    }

    const result = await generateText({
      model: "anthropic/claude-sonnet-4.5",
      prompt: `Create a storyboard for an 8-second video ad.

Product: ${prompt}
Visual Style: ${style || "cinematic"}
${referenceImageUrl ? `Reference Image: ${referenceImageUrl}` : ""}

${stylePersonality[style as keyof typeof stylePersonality] || stylePersonality.cinematic}

Create 3 scenes for an 8-second ad:
- [00:00-00:03] Opening Hook
- [00:03-00:06] Product Showcase  
- [00:06-00:08] Closing Message

For each scene, provide:
- SHORT SUMMARY (1 sentence)
- DETAILED DESCRIPTION (be creative and vivid)
- CAMERA MOVEMENT
- AUDIO (dialogue, SFX, music)
- PRODUCT_IDENTITY (consistent product description)

Return ONLY valid JSON:
{
  "productIdentity": "Product description",
  "audioStrategy": "Audio approach",
  "musicStyle": "Music style" or null,
  "voiceoverScript": "Script" or null,
  "moments": [
    {
      "timing": "[00:00-00:03]",
      "title": "Opening Hook",
      "summary": "Brief summary",
      "description": "Detailed creative description",
      "cameraMovement": "Camera movement",
      "audio": "Audio description",
      "productIdentity": "Product description"
    },
    {
      "timing": "[00:03-00:06]",
      "title": "Product Showcase",
      "summary": "Brief summary",
      "description": "Detailed creative description",
      "cameraMovement": "Camera movement",
      "audio": "Audio description",
      "productIdentity": "Product description"
    },
    {
      "timing": "[00:06-00:08]",
      "title": "Closing Message",
      "summary": "Brief summary",
      "description": "Detailed creative description with clear ending",
      "cameraMovement": "Camera movement",
      "audio": "Audio description",
      "productIdentity": "Product description"
    }
  ]
}`,
    })

    let storyboard
    try {
      storyboard = JSON.parse(result.text)
    } catch {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error("No JSON found in AI response")
      }
      storyboard = JSON.parse(jsonMatch[0])
    }

    return NextResponse.json(storyboard)
  } catch (error) {
    console.error("Error:", error)
    const errorMessage = error instanceof Error ? error.message : String(error)

    return NextResponse.json(
      {
        error: "Failed to generate storyboard",
        details: errorMessage,
      },
      { status: 500 },
    )
  }
}
