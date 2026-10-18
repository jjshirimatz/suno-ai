"use strict";

const { Readable } = require("node:stream");

exports.handler = async (event) => {

  const json = (statusCode, data) => ({
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(data)
  });

  if (event.httpMethod !== "GET") {
    return json(405, {
      error: "Method not allowed"
    });
  }

  const audioUrl =
    event.queryStringParameters?.url;

  const filename =
    event.queryStringParameters?.filename ||
    "AI-Music";

  if (!audioUrl) {
    return json(400, {
      error: "Audio URL haipo"
    });
  }

  let parsed;

  try {
    parsed = new URL(audioUrl);
  } catch {
    return json(400, {
      error: "Audio URL si sahihi"
    });
  }

  if (parsed.protocol !== "https:") {
    return json(400, {
      error: "HTTPS audio URL inahitajika"
    });
  }

  try {

    const controller =
      new AbortController();

    const timer = setTimeout(
      () => controller.abort(),
      60000
    );

    let response;

    try {
      response = await fetch(audioUrl, {
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      return json(502, {
        error: "Imeshindikana kupata audio"
      });
    }

    const buffer = Buffer.from(
      await response.arrayBuffer()
    );

    const safeName = filename
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 80);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition":
          `attachment; filename="${safeName}.mp3"`,
        "Cache-Control": "private, max-age=3600"
      },
      body: buffer.toString("base64"),
      isBase64Encoded: true
    };

  } catch (error) {

    console.error(
      "Download error:",
      error.message
    );

    return json(500, {
      error: "Download imeshindikana"
    });

  }

};
