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
  azureJson?.choices?.[0]?.message?.content || "No response from model";
