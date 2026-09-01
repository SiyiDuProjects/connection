const host = process.env.RAPIDAPI_PEOPLE_HOST || "fresh-linkedin-scraper-api.p.rapidapi.com";
const mode = process.argv[2] || "job";
const url = new URL(`https://${host}${mode === "company" ? "/api/v1/company/profile" : "/api/v1/job/detail"}`);
if (mode === "company") url.searchParams.set("company", process.argv[3] || "rapidapi");
else url.searchParams.set("job_id", process.argv[3] || "4431400939");

const response = await fetch(url, {
  headers: {
    "Accept": "application/json",
    "x-rapidapi-host": host,
    "x-rapidapi-key": process.env.RAPIDAPI_KEY
  }
});
const body = await response.json().catch(() => ({}));

console.log(JSON.stringify({
  status: response.status,
  retryAfter: response.headers.get("retry-after"),
  rateLimit: {
    limit: response.headers.get("x-ratelimit-requests-limit"),
    remaining: response.headers.get("x-ratelimit-requests-remaining"),
    reset: response.headers.get("x-ratelimit-requests-reset")
  },
  body: {
    success: body.success,
    cost: body.cost,
    message: body.message,
    explain: body.explain,
    jobId: mode === "job" ? body.data?.id : null,
    jobTitle: mode === "job" ? body.data?.title : null,
    company: mode === "company" && body.data ? {
      id: body.data.id,
      name: body.data.name,
      url: body.data.linkedin_url
    } : body.data?.company ? {
      id: body.data.company.id,
      name: body.data.company.name,
      url: body.data.company.url || body.data.company.linkedin_url
    } : null
  }
}));
