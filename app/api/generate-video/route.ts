import { NextResponse } from "next/server"
import { fal } from "@fal-ai/client"

export const maxDuration = 60
export const dynamic = "force-dynamic"

fal.config({
  credentials: process.env.FAL_KEY,
})

export async function POST(req: Request) {
  try {
    console.log("[v0] ========== VIDEO GENERATION REQUEST START ==========")
    console.log("[v0] API: Timestamp:", new Date().toISOString())
    console.log("[v0] API: Environment:", process.env.VERCEL_ENV || "local")
    console.log("[v0] API: FAL_KEY exists:", !!process.env.FAL_KEY)
    console.log("[v0] API: FAL_KEY length:", process.env.FAL_KEY?.length || 0)

    const body = await req.json()
    const { storyboard, images, productDescription, style } = body

    const bodyString = JSON.stringify(body)
    const bodySizeKB = (bodyString.length / 1024).toFixed(2)
    const bodySizeMB = (bodyString.length / 1024 / 1024).toFixed(2)
    console.log("[v0] API: Request body size:", bodySizeKB, "KB /", bodySizeMB, "MB")
    console.log("[v0] API: Vercel limit is 4.5 MB for serverless functions")

    console.log("[v0] API: Images count:", images?.length || 0)
    if (images && Array.isArray(images)) {
      images.forEach((img: string, idx: number) => {
        const isDataUrl = img?.startsWith("data:")
        const imgSize = img?.length || 0
        const imgSizeKB = (imgSize / 1024).toFixed(2)
        console.log(`[v0] API: Image ${idx + 1}:`, {
          isDataUrl,
          sizeKB: imgSizeKB,
          urlPreview: isDataUrl ? "data:..." : img?.substring(0, 100),
        })
      })
    }

    const storyboardString = JSON.stringify(storyboard)
    const storyboardSizeKB = (storyboardString.length / 1024).toFixed(2)
    console.log("[v0] API: Storyboard size:", storyboardSizeKB, "KB")
    console.log("[v0] API: Storyboard moments count:", storyboard?.moments?.length || 0)

    console.log("[v0] API: Product description:", productDescription)
    console.log("[v0] API: Style:", style)

    if (!storyboard || !images || images.length === 0) {
      console.error("[v0] API: Missing required fields")
      return NextResponse.json({ error: "Storyboard and images are required" }, { status: 400 })
    }

    if (images.length !== 3) {
      console.error("[v0] API: Wrong number of images:", images.length)
      return NextResponse.json({ error: `Expected 3 images but received ${images.length}` }, { status: 400 })
    }

    if (!process.env.FAL_KEY) {
      console.error("[v0] API: FAL_KEY is not configured!")
      return NextResponse.json(
        {
          error: "FAL_KEY not configured",
          details: "The FAL_KEY environment variable is missing. Please add it in your Vercel project settings.",
        },
        { status: 500 },
      )
    }

    console.log("[v0] API: Starting video generation with Veo 3.1")
    console.log("[v0] API: Request will take ~2 minutes")

    const videoPrompt = `Create an 8-second ${style} commercial for ${productDescription}.

SCENES:
${storyboard.moments
  .map(
    (m: any, idx: number) => `
${m.timing}: ${m.title}
${m.description}
Camera: ${m.cameraMovement}`,
  )
  .join("\n")}

Audio: ${storyboard.audioStrategy}
Music: ${storyboard.musicStyle}

Style: ${style}, cinematic, professional quality
Duration: 8 seconds
Smooth transitions between scenes`

    const negativePrompt = `blurry, low quality, distorted, warped, deformed, bad anatomy, watermark, signature`

    console.log("[v0] API: Video prompt length:", videoPrompt.length, "characters")
    console.log("[v0] API: Negative prompt length:", negativePrompt.length, "characters")
    console.log("[v0] API: Calling fal.ai Veo 3.1 API...")

    const falPayload = {
      image_urls: images,
      prompt: videoPrompt,
      negative_prompt: negativePrompt,
      duration: "8s",
      resolution: "720p",
      aspect_ratio: "16:9",
      generate_audio: true,
    }
    const falPayloadString = JSON.stringify(falPayload)
    const falPayloadSizeKB = (falPayloadString.length / 1024).toFixed(2)
    const falPayloadSizeMB = (falPayloadString.length / 1024 / 1024).toFixed(2)
    console.log("[v0] API: Payload to fal.ai size:", falPayloadSizeKB, "KB /", falPayloadSizeMB, "MB")

    let result: any
    try {
      result = await fal.subscribe("fal-ai/veo3.1/reference-to-video", {
        input: falPayload,
        logs: true,
        onQueueUpdate: (update) => {
          console.log("[v0] Veo 3.1 queue status:", update.status)
          if (update.status === "IN_PROGRESS") {
            if (update.logs) {
              update.logs
                .map((log: any) => log.message)
                .forEach((msg: string) => console.log("[v0] Veo 3.1 progress:", msg))
            }
          }
          if (update.status === "IN_QUEUE") {
            console.log("[v0] Veo 3.1 in queue, position:", (update as any).queue_position || "unknown")
          }
        },
      })
    } catch (falError) {
      console.error("[v0] API: fal.subscribe error:", falError)

      let errorMessage = "Unknown error from fal.ai"
      if (falError instanceof Error) {
        errorMessage = falError.message
      } else if (typeof falError === "object" && falError !== null) {
        errorMessage = (falError as any).message || (falError as any).error || JSON.stringify(falError)
      }

      throw new Error(`Fal.ai API error: ${errorMessage}`)
    }

    console.log("[v0] API: Veo 3.1 result received")
    console.log("[v0] API: Result type:", typeof result)
    console.log("[v0] API: Result keys:", result ? Object.keys(result) : "null")
    console.log("[v0] API: Full result structure:", JSON.stringify(result, null, 2))

    let videoUrl: string | undefined

    try {
      if (result && typeof result === "object") {
        if (result.video?.url) {
          videoUrl = result.video.url
          console.log("[v0] API: Found video URL at result.video.url")
        } else if (result.data?.video?.url) {
          videoUrl = result.data.video.url
          console.log("[v0] API: Found video URL at result.data.video.url")
        } else if (result.data?.url) {
          videoUrl = result.data.url
          console.log("[v0] API: Found video URL at result.data.url")
        } else if (result.url) {
          videoUrl = result.url
          console.log("[v0] API: Found video URL at result.url")
        } else if (result.output?.url) {
          videoUrl = result.output.url
          console.log("[v0] API: Found video URL at result.output.url")
        } else if (result.output?.video?.url) {
          videoUrl = result.output.video.url
          console.log("[v0] API: Found video URL at result.output.video.url")
        } else if (typeof result === "string") {
          videoUrl = result
          console.log("[v0] API: Result is a string URL")
        }
      }

      if (!videoUrl) {
        console.error("[v0] API: Could not find video URL in response")
        console.error("[v0] API: Available keys:", result ? Object.keys(result) : "none")
        throw new Error("Video URL not found in Veo 3.1 response. Check logs for response structure.")
      }

      console.log("[v0] API: Video URL:", videoUrl)
      console.log("[v0] API: Video generation successful!")
      console.log("[v0] ========== VIDEO GENERATION REQUEST END (SUCCESS) ==========")

      return NextResponse.json({
        videoUrl,
        prompt: videoPrompt,
        metadata: {
          duration: "8s",
          resolution: "720p",
          aspectRatio: "16:9",
          style,
          scenesCount: storyboard.moments.length,
        },
      })
    } catch (urlError) {
      console.error("[v0] API: Error extracting video URL:", urlError)
      console.error("[v0] API: Result structure:", JSON.stringify(result, null, 2))
      throw new Error(`Failed to extract video URL: ${urlError instanceof Error ? urlError.message : "Unknown error"}`)
    }
  } catch (error) {
    console.error("[v0] ========== VIDEO GENERATION REQUEST END (ERROR) ==========")
    console.error("[v0] API: Error generating video:", error)

    let errorMessage = "Unknown error occurred"
    let errorStack: string | undefined
    let errorName = "UnknownError"

    if (error instanceof Error) {
      errorMessage = error.message
      errorStack = error.stack
      errorName = error.name
    } else if (typeof error === "object" && error !== null) {
      errorMessage = (error as any).message || (error as any).error || JSON.stringify(error)
      errorName = (error as any).name || "UnknownError"
    } else {
      errorMessage = String(error)
    }

    console.error("[v0] API: Error name:", errorName)
    console.error("[v0] API: Error message:", errorMessage)
    if (errorStack) {
      console.error("[v0] API: Error stack:", errorStack)
    }

    return NextResponse.json(
      {
        error: "Failed to generate video",
        details: errorMessage,
        errorName: errorName,
        troubleshooting: {
          fal_key: "Check that FAL_KEY is configured in Vercel environment variables",
          timeout: "Video generation takes ~2 minutes. Requires maxDuration=60 (supported on Hobby/Pro)",
          images: "Ensure all 3 keyframe images are valid and accessible",
          request_size: "Check that request body is under 4.5MB (Vercel limit)",
          credits: "Verify your fal.ai account has sufficient credits",
        },
      },
      { status: 500 },
    )
  }
}
