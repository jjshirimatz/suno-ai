"use strict";

const API_BASE = "https://reapi.ai/api/v1/tasks/";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });

function safeFilename(value) {
  return String(value || "AI Music")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .trim()
    .slice(0, 90) || "AI Music";
}

function getOutput(data) {
  const root =
    data?.data && typeof data.data === "object"
      ? data.data
      : data;

  const output =
    root?.output && typeof root.output === "object"
      ? root.output
      : {};

  const tracks = Array.isArray(output.tracks)
    ? output.tracks
    : [];

  const urls = Array.isArray(output.audio_urls)
    ? output.audio_urls
    : [];

  const songs = [];
  const seen = new Set();

  tracks.forEach((track, index) => {
    const url =
      track?.url ||
      track?.audio_url ||
      urls[index];

    if (
      typeof url === "string" &&
      !seen.has(url)
    ) {
      seen.add(url);

      songs.push({
        title: track?.title || "AI Music",
        url
      });
    }
  });

  urls.forEach((url, index) => {
    if (
      typeof url === "string" &&
      !seen.has(url)
    ) {
      seen.add(url);

      songs.push({
        title: tracks[index]?.title || "AI Music",
        url
      });
    }
  });

  return songs;
}

function isAllowedAudioURL(value) {
  try {
    const url = new URL(value);

    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port
    ) {
      return false;
    }

    const host = url.hostname.toLowerCase();

    // Usiruhusu localhost, IP addresses au internal hosts.
    if (
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      /^\d+\.\d+\.\d+\.\d+$/.test(host) ||
      host.includes(":")
    ) {
      return false;
    }

    // Ruhusu tu vyanzo vinavyojulikana vya audio.
    const allowedDomains = [
      "suno.ai",
      "reapi.ai",
      "googleapis.com",
      "googleusercontent.com",
      "cloudfront.net",
      "amazonaws.com"
    ];

    return allowedDomains.some(
      domain =>
        host === domain ||
        host.endsWith("." + domain)
    );
  } catch {
    return false;
  }
}

export default async function handler(request) {
  if (request.method !== "GET") {
    return json(
      { success: false, error: "Method not allowed" },
      405
    );
  }

  const apiKey = process.env.REAPI_API_KEY;

  if (!apiKey) {
    return json(
      {
        success: false,
        error: "REAPI_API_KEY haipo."
      },
      500
    );
  }

  const url = new URL(request.url);

  const taskId = url.searchParams.get("task_id") || "";
  const index = Number(url.searchParams.get("index"));

  if (
    !/^[a-zA-Z0-9_-]{8,150}$/.test(taskId) ||
    !Number.isInteger(index) ||
    index < 0 ||
    index > 10
  ) {
    return json(
      {
        success: false,
        error: "Task ID au track index si sahihi."
      },
      400
    );
  }

  try {
    const taskResponse = await fetch(
      API_BASE + encodeURIComponent(taskId),
      {
        headers: {
          Authorization: "Bearer " + apiKey,
          Accept: "application/json"
        },
        signal: AbortSignal.timeout(20000)
      }
    );

    if (!taskResponse.ok) {
      return json(
        {
          success: false,
          error: "Imeshindikana kuthibitisha wimbo."
        },
        502
      );
    }

    const taskData = await taskResponse.json();

    const songs = getOutput(taskData);

    const song = songs[index];

    if (!song || !isAllowedAudioURL(song.url)) {
      return json(
        {
          success: false,
          error: "Audio haijapatikana au URL haijaruhusiwa."
        },
        404
      );
    }

    const audioResponse = await fetch(song.url, {
      method: "GET",
      redirect: "manual",
      headers: {
        Accept: "audio/*,application/octet-stream"
      },
      signal: AbortSignal.timeout(30000)
    });

    if (
      !audioResponse.ok ||
      !audioResponse.body
    ) {
      return json(
        {
          success: false,
          error: "Audio server haijaruhusu download."
        },
        502
      );
    }

    const contentType =
      audioResponse.headers.get("content-type") || "";

    if (
      contentType.includes("text/html") ||
      contentType.includes("application/json")
    ) {
      await audioResponse.body.cancel();

      return json(
        {
          success: false,
          error: "Server haijarudisha faili la audio."
        },
        502
      );
    }

    const filename = safeFilename(song.title);

    const responseHeaders = new Headers({
      "Content-Type": contentType || "audio/mpeg",
      "Content-Disposition":
        "attachment; filename*=UTF-8''" +
        encodeURIComponent(filename + ".mp3"),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff"
    });

    const length =
      audioResponse.headers.get("content-length");

    if (length && /^\d+$/.test(length)) {
      responseHeaders.set("Content-Length", length);
    }

    return new Response(audioResponse.body, {
      status: 200,
      headers: responseHeaders
    });

  } catch (error) {
    console.error(
      "Download error:",
      error?.name,
      error?.message
    );

    return json(
      {
        success: false,
        error: "Download imeshindikana."
      },
      502
    );
  }
}
