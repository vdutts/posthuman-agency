import { NextResponse } from "next/server"
import * as fal from "@fal-ai/serverless-client"

// Configure fal client
fal.config({
  credentials: process.env.FAL_KEY,
})

export async function POST(req: Request) {
  try {
    const { description, seedImageUrl, referenceImageUrl, productDescription, style, productIdentity, seed } =
      await req.json()

    console.log("[v0] API: Generating image with fal.ai/nano-banana")
    console.log("[v0] API: Seed image:", !!seedImageUrl)
    console.log("[v0] API: Reference image:", !!referenceImageUrl)
    console.log("[v0] API: Product identity:", productIdentity)
    console.log("[v0] API: Seed value:", seed)
    console.log("[v0] API: Style:", style)

    if (!description) {
      return NextResponse.json({ error: "Description is required" }, { status: 400 })
    }

    if (!process.env.FAL_KEY) {
      console.error("[v0] API: FAL_KEY environment variable is not set")
      return NextResponse.json(
        { error: "FAL_KEY not configured", details: "Please add your fal.ai API key to environment variables" },
        { status: 500 },
      )
    }

    let prompt: string

    if (seedImageUrl || referenceImageUrl) {
      const imageToUse = seedImageUrl || referenceImageUrl
      prompt = `${description}

Style: ${style}
Product: ${productDescription}
${productIdentity ? `Product Identity: ${productIdentity}` : ""}
${seed ? `Seed: ${seed}` : ""}

Create a stunning, creative image.`
    } else {
      prompt = `${description}

Style: ${style}
Product: ${productDescription}
${productIdentity ? `Product Identity: ${productIdentity}` : ""}
${seed ? `Seed: ${seed}` : ""}

Create a stunning, creative image.`
    }

    console.log("[v0] API: Prompt:", prompt.substring(0, 300))

    const input: any = {
      prompt,
      num_images: 1,
      image_size: "landscape_16_9",
      num_inference_steps: 4,
    }

    // Add seed if provided
    if (seed) {
      input.seed = seed
    }

    const imageUrlToUse = seedImageUrl || referenceImageUrl
    if (imageUrlToUse) {
      console.log("[v0] API: Using image URL:", imageUrlToUse.substring(0, 100))
      console.log("[v0] API: Image type:", seedImageUrl ? "seed (scene consistency)" : "reference (brand consistency)")
      input.image_url = imageUrlToUse
      // Lower strength = MORE influence from reference image (preserves logo/brand)
      // Higher strength = MORE transformation (ignores reference)
      input.strength = referenceImageUrl ? 0.35 : 0.5 // Use 0.35 for reference images (brand), 0.5 for seed images (scenes)
    }

    console.log("[v0] API: Calling fal.ai/nano-banana with input:", JSON.stringify(input, null, 2))

    let result: any
    try {
      result = await fal.subscribe("fal-ai/nano-banana", {
        input,
        logs: true,
        onQueueUpdate: (update) => {
          console.log("[v0] API: Queue update:", update.status)
        },
      })
      console.log("[v0] API: fal.ai response received successfully")
    } catch (falError) {
      console.error("[v0] API: fal.subscribe threw an error:", falError)
      console.error("[v0] API: Error type:", falError instanceof Error ? falError.constructor.name : typeof falError)

      let errorMessage = "Unknown error occurred"
      let errorDetails = ""

      if (falError instanceof Error) {
        errorMessage = falError.message || "Error from fal.ai"
        errorDetails = falError.stack || ""
        console.error("[v0] API: Error message:", errorMessage)
        console.error("[v0] API: Error stack:", errorDetails)
      } else if (typeof falError === "object" && falError !== null) {
        // Handle non-Error objects
        errorMessage = (falError as any).message || (falError as any).error || "Error from fal.ai"
        errorDetails = JSON.stringify(falError, null, 2)
        console.error("[v0] API: Error object:", errorDetails)
      } else {
        errorMessage = String(falError) || "Unknown error from fal.ai"
        console.error("[v0] API: Error string:", errorMessage)
      }

      return NextResponse.json(
        {
          error: "Failed to generate image with fal.ai",
          details: errorMessage,
          troubleshooting: {
            fal_key: "Verify FAL_KEY is valid and has sufficient credits",
            prompt: "Check if prompt is too long or contains invalid content",
            image_url: imageUrlToUse ? "Verify image URL is accessible" : "No image URL provided",
          },
        },
        { status: 500 },
      )
    }

    console.log("[v0] API: Result type:", typeof result)
    console.log("[v0] API: Result keys:", result ? Object.keys(result) : "null")
    console.log("[v0] API: Full result:", JSON.stringify(result, null, 2))
    console.log("[v0] API: result.images exists:", !!result?.images)
    console.log("[v0] API: result.images length:", result?.images?.length || 0)

    const imageUrl = result?.images?.[0]?.url

    if (!imageUrl) {
      console.error("[v0] API: No image URL in response. Full result:", JSON.stringify(result, null, 2))
      return NextResponse.json(
        { error: "No image was generated", details: "fal.ai returned no image URL" },
        { status: 500 },
      )
    }

    console.log("[v0] API: ✅ Successfully generated image with fal.ai")
    console.log("[v0] API: Image URL:", imageUrl)
    console.log("[v0] API: URL length:", imageUrl.length, "characters")

    return NextResponse.json({
      imageUrl, // Return HTTP URL directly from fal.ai
      fullPrompt: prompt,
    })
  } catch (error) {
    console.error("[v0] API: Error generating moment image:", error)
    console.error("[v0] API: Error type:", error instanceof Error ? error.constructor.name : typeof error)

    let errorMessage = "Unknown error occurred"

    if (error instanceof Error) {
      errorMessage = error.message || "Internal server error"
      console.error("[v0] API: Error message:", errorMessage)
      console.error("[v0] API: Error stack:", error.stack)
    } else if (typeof error === "object" && error !== null) {
      errorMessage = (error as any).message || (error as any).error || "Internal server error"
      console.error("[v0] API: Error object:", JSON.stringify(error, null, 2))
    } else {
      errorMessage = String(error) || "Internal server error"
      console.error("[v0] API: Error string:", errorMessage)
    }

    return NextResponse.json(
      {
        error: "Failed to generate image",
        details: errorMessage,
        troubleshooting: {
          check_logs: "Review server logs for detailed error information",
          fal_key: "Ensure FAL_KEY environment variable is set correctly",
          request: "Verify all required parameters are provided",
        },
      },
      { status: 500 },
    )
  }
}
