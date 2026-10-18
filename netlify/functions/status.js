"use strict";

// ==========================================
// REAPI SUNO V6 - STATUS FUNCTION
// ==========================================

const REAPI_TASK_URL =
  "https://reapi.ai/api/v1/tasks/";

const REQUEST_TIMEOUT = 20000;

// ==========================================
// JSON RESPONSE
// ==========================================

function json(statusCode, data) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(data)
  };
}

// ==========================================
// CLEAN TEXT
// ==========================================

function cleanText(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

// ==========================================
// VALIDATE AUDIO URL
// ==========================================

function safeURL(value) {

  if (typeof value !== "string") {
    return "";
  }

  try {

    const url = new URL(value);

    if (
      url.protocol === "https:" ||
      url.protocol === "http:"
    ) {
      return url.href;
    }

    return "";

  } catch {

    return "";

  }
}

// ==========================================
// VALIDATE DURATION
// ==========================================

function safeDuration(value) {

  const duration = Number(value);

  if (
    !Number.isFinite(duration) ||
    duration < 0
  ) {
    return 0;
  }

  return duration;
}

// ==========================================
// EXTRACT API ERROR
// ==========================================

function getApiMessage(data) {

  const candidates = [
    data?.error?.message,
    data?.error?.detail,
    data?.message,
    data?.detail,
    typeof data?.error === "string"
      ? data.error
      : ""
  ];

  return candidates.find(
    value =>
      typeof value === "string" &&
      value.trim()
  ) || "";

}

// ==========================================
// MAIN HANDLER
// ==========================================

exports.handler = async (event) => {

  // ========================================
  // ALLOW GET ONLY
  // ========================================

  if (event.httpMethod !== "GET") {

    return json(405, {
      success: false,
      error: "Method not allowed"
    });

  }

  try {

    // ======================================
    // ENVIRONMENT VARIABLES
    // ======================================

    const apiKey = cleanText(
      process.env.REAPI_API_KEY
    );

    if (!apiKey) {

      console.error(
        "Missing REAPI_API_KEY"
      );

      return json(500, {
        success: false,
        error:
          "reAPI key haipo kwenye Netlify"
      });

    }

    // ======================================
    // READ TASK ID
    // ======================================

    const taskId = cleanText(
      event.queryStringParameters?.task_id
    );

    if (
      !/^[a-zA-Z0-9_-]{8,150}$/.test(taskId)
    ) {

      return json(400, {
        success: false,
        error:
          "Task ID si sahihi"
      });

    }

    // ======================================
    // REQUEST TIMEOUT
    // ======================================

    const controller =
      new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT
    );

    let response;
    let raw;

    // ======================================
    // FETCH REAPI TASK
    // ======================================

    try {

      response = await fetch(
        REAPI_TASK_URL +
          encodeURIComponent(taskId),
        {
          method: "GET",
          headers: {
            Authorization:
              "Bearer " + apiKey,
            Accept:
              "application/json"
          },
          signal:
            controller.signal
        }
      );

      raw = await response.text();

    } finally {

      clearTimeout(timeout);

    }

    // ======================================
    // PARSE RESPONSE
    // ======================================

    let data;

    try {

      data = JSON.parse(raw);

    } catch {

      console.error(
        "reAPI returned invalid JSON",
        {
          httpStatus:
            response.status
        }
      );

      return json(502, {
        success: false,
        error:
          "reAPI imerudisha majibu yasiyo JSON"
      });

    }

    // ======================================
    // HANDLE HTTP ERRORS
    // ======================================

    if (!response.ok) {

      const apiMessage =
        getApiMessage(data);

      console.error(
        "reAPI status error:",
        {
          httpStatus:
            response.status,
          apiCode:
            data?.error?.code ??
            data?.code ??
            null,
          apiMessage:
            apiMessage.slice(0, 200)
        }
      );

      // INVALID API KEY

      if (
        response.status === 401 ||
        response.status === 403
      ) {

        return json(502, {
          success: false,
          error:
            "reAPI imekataa API Key au ruhusa ya akaunti"
        });

      }

      // RATE LIMIT

      if (response.status === 429) {

        return json(429, {
          success: false,
          error:
            "reAPI imefikia kikomo cha maombi. Jaribu tena baadaye."
        });

      }

      // OTHER ERRORS

      return json(502, {
        success: false,
        error:
          "Imeshindikana kuangalia hali ya wimbo",
        http_status:
          response.status
      });

    }

    // ======================================
    // ROOT DATA
    // ======================================

    const root =
      data?.data &&
      typeof data.data === "object"
        ? data.data
        : data;

    // ======================================
    // READ TASK STATUS
    // ======================================

    const rawStatus = cleanText(
      root?.status ||
      root?.state ||
      data?.status ||
      data?.state
    ).toLowerCase();

    // ======================================
    // STATUS CATEGORIES
    // ======================================

    const failedStates = [
      "failed",
      "failure",
      "error",
      "cancelled",
      "canceled"
    ];

    const completedStates = [
      "completed",
      "complete",
      "succeeded",
      "success"
    ];

    // ======================================
    // READ OUTPUT
    // ======================================

    const output =
      root?.output &&
      typeof root.output === "object"
        ? root.output
        : {};

    // ======================================
    // SONGS COLLECTION
    // ======================================

    const songs = [];

    const seenUrls = new Set();

    // ======================================
    // ADD SONG
    // ======================================

    function addSong(
      title,
      audioUrl,
      duration
    ) {

      const url = safeURL(audioUrl);

      if (
        !url ||
        seenUrls.has(url)
      ) {
        return;
      }

      seenUrls.add(url);

      songs.push({
        title:
          cleanText(title) ||
          "AI Music",

        audioUrl: url,

        duration:
          safeDuration(duration)
      });

    }

    // ======================================
    // PROCESS TRACK OBJECT
    // ======================================

    function processTrack(track) {

      if (
        !track ||
        typeof track !== "object"
      ) {
        return;
      }

      addSong(
        track.title ||
          track.song_name ||
          track.name,

        track.audioUrl ||
          track.audio_url ||
          track.music_url ||
          track.musicUrl ||
          track.song_url ||
          track.stream_url ||
          track.play_url ||
          track.url,

        track.duration ??
          track.duration_seconds ??
          track.audio_duration ??
          0
      );

    }

    // ======================================
    // PROCESS TRACK ARRAYS
    // ======================================

    const trackCollections = [
      output.tracks,
      output.songs,
      output.audios,
      root?.tracks,
      root?.songs,
      data?.songs
    ];

    trackCollections.forEach(
      collection => {

        if (!Array.isArray(collection)) {
          return;
        }

        collection.forEach(
          processTrack
        );

      }
    );

    // ======================================
    // PROCESS AUDIO URL ARRAYS
    // ======================================

    const audioCollections = [
      output.audio_urls,
      output.audioUrls,
      root?.audio_urls,
      root?.audioUrls
    ];

    audioCollections.forEach(
      collection => {

        if (!Array.isArray(collection)) {
          return;
        }

        collection.forEach(
          (url, index) => {

            const track =
              Array.isArray(output.tracks)
                ? output.tracks[index]
                : null;

            addSong(
              track?.title ||
                track?.song_name ||
                "",

              url,

              track?.duration ??
                track?.duration_seconds ??
                0
            );

          }
        );

      }
    );

    // ======================================
    // PROCESS DIRECT OUTPUT
    // ======================================

    processTrack(output);
    processTrack(root);

    // ======================================
    // DETERMINE FINAL STATUS
    // ======================================

    let status = "processing";

    if (
      failedStates.includes(rawStatus) ||
      data?.success === false
    ) {

      status = "failed";

    } else if (
      completedStates.includes(rawStatus)
    ) {

      status =
        songs.length > 0
          ? "completed"
          : "processing";

    }

    // ======================================
    // SAFE BACKEND LOG
    // ======================================

    console.log(
      "reAPI task status:",
      {
        taskId,
        rawStatus,
        status,
        songsFound:
          songs.length
      }
    );

    // ======================================
    // SUCCESS RESPONSE
    // ======================================

    return json(200, {

      success: true,

      task_id: taskId,

      status,

      raw_status: rawStatus,

      songs,

      message:
        status === "completed"
          ? "Nyimbo zimepatikana"
          : status === "failed"
            ? "Utengenezaji wa wimbo umeshindikana"
            : "Wimbo unaendelea kutengenezwa"

    });

  } catch (error) {

    // ======================================
    // TIMEOUT
    // ======================================

    if (
      error?.name === "AbortError"
    ) {

      return json(504, {
        success: false,
        error:
          "reAPI imechelewa kujibu"
      });

    }

    // ======================================
    // BACKEND ERROR
    // ======================================

    console.error(
      "Status backend error:",
      error?.name,
      error?.message
    );

    return json(500, {
      success: false,
      error:
        "Tatizo limetokea wakati wa kuangalia wimbo"
    });

  }

};
