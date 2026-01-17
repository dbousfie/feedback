# Paragraph Marker Bot

A grading assistant bot for self-evaluating student paragraphs using a structured rubric defined in `syllabus.txt`. This tool is optimized for use in political science and related disciplines where grading criteria are detailed and paragraph-specific.

## What It Does

* Accepts paragraph submissions via a web form
* Uses Azure OpenAI (GPT-4.1-mini) to analyze paragraph structure and content
* Applies detailed grading criteria from `syllabus.txt`
* Returns structured feedback and an explicit grade (A–D)
* Optionally logs each query and response to Qualtrics if configured

## Instructor Guidance Feature

You can prepend any submission with instructor input using this format:

```
dsb2025 - This paragraph fails to address the question logically and gives no specific examples.

In wartime, international law...
```

This instruction is not shown in the feedback but influences how the bot interprets the paragraph.

## Setup Instructions

### 1. Fork the Repository

Create a copy using GitHub's "Use this template" function.

### 2. Replace Grading Criteria

Edit `syllabus.txt` to reflect your own paragraph marking rubric.

### 3. Set up Azure OpenAI api key
Follow this tutorial https://www.youtube.com/watch?v=UB3q4OY3pPM
Do not need to use Postman, simply know where to find the KEY and Endpoint. It will be used in next step.
* Note: when finding API_KEY, make sure you select Azure OpenAI SDK in the rightmost dropdown on the Azure playground page as shown in the tutorial video.

### 4. Deploy the API Backend on Deno

* Go to [https://dash.deno.com](https://dash.deno.com)
* Create a new project and set `main.ts` as the entry point
* Configure environment variables:

```
AZURE_API_KEY           = your Azure key
AZURE_ENDPOINT          = your Azure endpoint URL
SYLLABUS_LINK           = optional link to course page
QUALTRICS_API_TOKEN     = optional
QUALTRICS_SURVEY_ID     = optional
QUALTRICS_DATACENTER    = optional (e.g., uwo.eu)
```

### 5. Host the Frontend Separately

* Push `index.html` to a GitHub Pages repo or Netlify
* In `index.html`, set the `fetch()` URL to your deployed Deno backend:

```js
fetch("https://your-deno-project.deno.dev/", {
```

## Editing Files in GitHub's Web Interface

If you only use GitHub's web UI, these are the two files to edit:

* `index.html` — the frontend (dropdowns, form, and GitHub content loading).
* `main.ts` — the Deno backend entry point.

To edit either file in the web UI:

1. Open the file in your repo.
2. Click the pencil icon (Edit this file).
3. Paste your updated content.
4. Commit changes.

### 6. Enable GitHub Pages (Optional)

Settings → Pages → Source = `main` branch → root

### 7. (Optional) Embed in Brightspace

Use `brightspace.html` with an iframe pointing to your hosted frontend.

### 8. Qualtrics Logging Setup (Optional)
If using Qualtrics, make sure your survey contains embedded data fields:

```
responseText
queryText
```

These will be populated by the bot. Responses will include a hidden HTML comment like:
`<!-- Qualtrics status: 200 -->`

## Notes

* Input is transmitted securely over HTTPS
* No artificial limit is imposed on paragraph length, but large inputs may be truncated by token limits
* Feedback always ends with a disclaimer directing students to the course website
* A hidden HTML comment shows Qualtrics logging status

## License

© Dan Bousfield. Licensed under Creative Commons Attribution 4.0
[https://creativecommons.org/licenses/by/4.0/](https://creativecommons.org/licenses/by/4.0/)
