// main.ts (FIXED VERSION)
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const AZURE_API_KEY = Deno.env.get("AZURE_API_KEY");
const AZURE_ENDPOINT = Deno.env.get("AZURE_ENDPOINT");

const QUALTRICS_API_TOKEN = Deno.env.get("QUALTRICS_API_TOKEN");
const QUALTRICS_SURVEY_ID = Deno.env.get("QUALTRICS_SURVEY_ID");
const QUALTRICS_DATACENTER = Deno.env.get("QUALTRICS_DATACENTER");

const SYLLABUS_LINK = Deno.env.get("SYLLABUS_LINK") || "";

type RequestBody = {
  course: string;
  query: string;
  syllabus?: string;
  assessment?: string;
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (!body.course || !body.query) {
    return new Response("Missing course or query", { status: 400 });
  }

  if (!AZURE_API_KEY || !AZURE_ENDPOINT) {
    return new Response("Missing Azure configuration", { status: 500 });
  }

  // Prefer text from the web page; fallback to local syllabus file if missing
  const syllabusFile = `syllabi/${body.course}syllabus.md`;
  const syllabus =
    body.syllabus ??
    (await Deno.readTextFile(syllabusFile).catch(() => ""));

  // Assignment should come from the web page
  const assessment = body.assessment ?? "";

  // -----------------------------------------------------------
  // Determine if the assessment file contains its own feedback
  // instructions (heuristic: look for instruction-like keywords)
  // -----------------------------------------------------------
  const hasCustomInstructions = /\b(criterion|feedback|rubric|evaluate|assess|grading scheme|instruction set|general rules)\b/i.test(assessment);

  // -----------------------------------------------------------
  // Build the system prompt
  // -----------------------------------------------------------
  let systemPrompt: string;

  if (hasCustomInstructions) {
    // The assessment file has its own detailed instructions — defer to them
    systemPrompt = [
      "You are a feedback assistant for a university course. Your output will be copy-pasted directly to the student. Write as if you are the instructor speaking to the student.",
      "",
      "The ASSIGNMENT file below contains detailed feedback instructions and rubric criteria. Follow those instructions exactly.",
      "",
      "VOICE RULES — NON-NEGOTIABLE:",
      "- Write directly to the student in the second person ('you', 'your paper').",
      "- NEVER refer to 'the instructor', 'the instructor's guidance', 'the instructor flagged', 'the instructor's comments', 'the reviewer', or any third-party framing. The student will read this as if the instructor wrote it. Saying 'the instructor flagged X' is broken output.",
      "- NEVER say things like 'violating the instructor's guidance' or 'per the instructor's note'. Just say 'you violated X' or 'you need to do X'.",
      "- Speak in the first person where natural ('I want to see', 'I flagged this') or direct imperative ('Do X', 'Stop doing Y').",
      "",
      "DO NOT PARAPHRASE INSTRUCTOR COMMENTS BACK. The student will already read the instructor's comments separately. Your job is to APPLY those comments to specific passages in the student's submission:",
      "- Quote specific phrases or sentences from the STUDENT'S submission (not from the instructor's comments).",
      "- Point at exactly where in the submission the problem occurs.",
      "- Tell the student what to do about that specific passage.",
      "- If the instructor identified a category of problem (e.g., scare quotes, missing topic sentences, lack of examples), find every instance of that problem in the submission and list them with short student quotes.",
      "- Do not restate the instructor's general points in new words. Extend them with concrete textual evidence from the submission.",
      "",
      "OTHER RULES:",
      "- If the instructor has provided reviewer comments, those comments are AUTHORITATIVE. They override your own analysis. But your feedback must be grounded in the student's text, not in summarizing the instructor's comments.",
      "- Output plain text only. No Markdown headings, no bold, no asterisks. If you use bullets, use hyphens only.",
      "- Do NOT include any grades, scores, percentages, or numeric evaluation unless the assignment instructions explicitly require it.",
      "- Match the tone of the instructor's comments. If they are critical, be critical. Do not add padding praise to soften critical feedback.",
    ].join("\n");
  } else {
    // The assessment file is just an assignment description — use the full directive prompt
    systemPrompt = [
      "You are a feedback assistant for a university course. Your output will be copy-pasted directly to the student. Write as if you are the instructor speaking to the student.",
      "",
      "CRITICAL VOICE RULES — NON-NEGOTIABLE:",
      "",
      "A. WRITE DIRECTLY TO THE STUDENT IN THE SECOND PERSON. Use 'you' and 'your paper'. NEVER write 'the instructor flagged', 'the instructor's guidance', 'the instructor's comments', 'the reviewer noted', or any third-party framing. The student will read this as if it came from the instructor's mouth. Saying 'the instructor flagged X' is broken output that cannot be copy-pasted.",
      "",
      "B. DO NOT PARAPHRASE THE INSTRUCTOR'S COMMENTS BACK. The instructor's comments are your authoritative guide, but the student will see those comments separately. Your job is to APPLY those comments to specific passages in the student's submission:",
      "   - Quote specific phrases or sentences FROM THE STUDENT'S SUBMISSION (not from the instructor's comments).",
      "   - Point at exactly where in the submission each problem occurs.",
      "   - Tell the student what to do about that specific passage.",
      "   - If the instructor identified a category of problem (scare quotes, missing topic sentences, lack of examples, single-source reliance, etc.), find every instance of that problem in the submission and list them with short student quotes.",
      "   - Do NOT restate the instructor's general points in new words. Extend them with concrete textual evidence from the student's writing.",
      "",
      "CRITICAL CONTENT RULES:",
      "",
      "1. THE INSTRUCTOR'S COMMENTS ARE PRIMARY. If the instructor has provided reviewer comments, those comments are the authoritative assessment. Do not contradict them, do not soften them, do not override them. But ground every point in specific student text, not in repetition of the instructor's phrasing.",
      "",
      "2. DO NOT PAD WITH GENERIC PRAISE. If the instructor's comments are critical, your feedback must be critical. Do not add praise about grammar, writing style, or presentation to soften critical feedback.",
      "",
      "3. MATCH THE INSTRUCTOR'S TONE. If the instructor is direct and sharp, be direct and sharp.",
      "",
      "4. USE THE ASSIGNMENT DESCRIPTION AS YOUR RUBRIC. Organize your feedback under these categories (skip any not relevant):",
      "   - Title, topic, and thesis",
      "   - Use of course framework and analytical content",
      "   - Arguments with evidence (three distinct arguments with support?)",
      "   - Engagement with academic sources and triangulation",
      "   - Citation and paragraph structure compliance",
      "   - Use of evidence, examples, and specificity",
      "",
      "5. USE THE SYLLABUS FOR STRUCTURAL REQUIREMENTS (paragraph structure, minimum three sources per paragraph, author-date with page numbers, etc.). When the student violates these, quote the student's specific passage that shows the violation.",
      "",
      "6. CITE SPECIFIC PASSAGES. Every criticism should be anchored to a short quote from the student's submission. 'Your topic sentence in paragraph 3 reads X — this is abstract and doesn't name who is making the claim.' Not 'topic sentences lack specificity.'",
      "",
      "7. GIVE ACTIONABLE NEXT STEPS. Tell the student what to write instead, where to find it, or what specific change to make.",
      "",
      "8. OUTPUT FORMAT: Plain text only. No Markdown headings, no bold, no asterisks. Hyphens for bullets. Do NOT include any grades, scores, percentages, points, or numeric evaluation.",
      "",
      "9. If the instructor says the paper does not meet the assignment requirements, do not equivocate. State clearly what is missing and what the student must do differently.",
    ].join("\n");
  }

  const messages: Array<{ role: string; content: string }> = [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "system",
      content: `COURSE SYLLABUS (defines paragraph structure, citation rules, source requirements, and grading criteria):\n\n${syllabus || "[No syllabus text provided]"}`,
    },
    {
      role: "system",
      content: `ASSIGNMENT REQUIREMENTS:\n\n${assessment || "[No assignment text provided]"}`,
    },
    {
      role: "user",
      content: body.query,
    },
  ];

  // =========================
  // AZURE CALL
  // =========================
  const azureResponse = await fetch(AZURE_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": AZURE_API_KEY,
    },
    body: JSON.stringify({ messages }),
  });

  const azureText = await azureResponse.text();

  if (!azureResponse.ok) {
    return new Response(azureText, {
      status: azureResponse.status,
      headers: {
        "Content-Type": "text/plain",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  let azureJson: any;
  try {
    azureJson = JSON.parse(azureText);
  } catch {
    return new Response(azureText, {
      headers: {
        "Content-Type": "text/plain",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  const baseResponse =
    azureJson?.choices?.[0]?.message?.content || "No response from Azure OpenAI";

  const result =
    `${baseResponse}\n\nThere may be errors in my responses; always refer to the course web page: ${SYLLABUS_LINK}`;

  // =========================
  // QUALTRICS (OPTIONAL)
  // =========================
  let qualtricsStatus = "Qualtrics not called";

  if (QUALTRICS_API_TOKEN && QUALTRICS_SURVEY_ID && QUALTRICS_DATACENTER) {
    const qualtricsPayload = {
      values: {
        responseText: result,
        queryText: body.query,
      },
    };

    try {
      const qt = await fetch(
        `https://${QUALTRICS_DATACENTER}.qualtrics.com/API/v3/surveys/${QUALTRICS_SURVEY_ID}/responses`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-TOKEN": QUALTRICS_API_TOKEN,
          },
          body: JSON.stringify(qualtricsPayload),
        },
      );

      qualtricsStatus = `Qualtrics status: ${qt.status}`;
    } catch {
      qualtricsStatus = "Qualtrics error (request failed)";
    }
  }

  return new Response(`${result}\n<!-- ${qualtricsStatus} -->`, {
    headers: {
      "Content-Type": "text/plain",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
