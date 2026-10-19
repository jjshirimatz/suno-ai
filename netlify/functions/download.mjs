export default async function handler(request) {
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { "Content-Type": "application/json" } });
  }

  const urlObj = new URL(request.url);
  const audioUrl = urlObj.searchParams.get("url");
  let title = urlObj.searchParams.get("title") || "AI_Music";

  if (!audioUrl) {
    return new Response(JSON.stringify({ error: "URL ya wimbo haijapatikana." }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  // Hakikisha ni URL salama
  if (!audioUrl.startsWith("https://")) {
    return new Response(JSON.stringify({ error: "URL hairuhusiwi." }), { status: 403, headers: { "Content-Type": "application/json" } });
  }

  // Safisha jina la faili kuondoa alama zinazosumbua kwenye simu/PC
  title = title.replace(/[<>:"/\\|?*\x00-\x1F]/g, "").trim().slice(0, 100) || "AI_Music";

  try {
    const audioResponse = await fetch(audioUrl, {
      method: "GET",
      headers: {
        "Accept": "audio/*,video/*,application/octet-stream"
      }
    });

    if (!audioResponse.ok) {
      return new Response(JSON.stringify({ error: "Imeshindwa kudownload kutoka server ya muziki." }), { status: 502, headers: { "Content-Type": "application/json" } });
    }

    // Tengeneza headers za kulazimisha kivinjari kudownload faili
    const headers = new Headers();
    headers.set("Content-Type", audioResponse.headers.get("content-type") || "audio/mpeg");
    headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(title + ".mp3")}`);
    
    const contentLength = audioResponse.headers.get("content-length");
    if (contentLength) {
      headers.set("Content-Length", contentLength);
    }

    return new Response(audioResponse.body, {
      status: 200,
      headers: headers
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: "Kuna tatizo la mtandao." }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
