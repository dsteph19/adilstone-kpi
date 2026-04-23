exports.handler = async function(event) {
  const SUPABASE_URL = "https://yzsudrdfcebhoxfpdtys.supabase.co";
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  const params = event.queryStringParameters || {};
  const table = params.table || "";
  const qs = params.qs || "";
  const target = SUPABASE_URL + "/rest/v1/" + table + (qs ? "?" + qs : "");

  const prefer = (event.headers && event.headers["prefer"]) || "return=minimal";

  try {
    const response = await fetch(target, {
      method: event.httpMethod,
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
        "Prefer": prefer,
      },
      body: event.httpMethod !== "GET" ? event.body : undefined,
    });

    const data = await response.text();

    return {
      statusCode: response.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Prefer",
      },
      body: data,
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};