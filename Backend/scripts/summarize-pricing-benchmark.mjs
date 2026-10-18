// Recompute summaries from a saved report without making any API calls.
import { readFile, writeFile } from 'node:fs/promises';

const reportPath = process.argv[2];
if (!reportPath) throw new Error('Pass the path of a saved benchmark JSON report.');
const report = JSON.parse(await readFile(reportPath, 'utf8'));
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2 : null;
};
for (const level of ['low', 'medium']) {
  const rows = report.results.filter((row) => row.thinkingLevel === level);
  const priced = rows.filter((row) => row.status === 'estimated');
  Object.assign(report.summary[level], {
    providerUnavailable: rows.filter((row) => row.providerStatus === 503).length,
    quotaErrors: rows.filter((row) => row.httpStatus === 429).length,
    medianEstimateMs: median(priced.map((row) => row.elapsedMs)),
    slowestEstimateMs: priced.length ? Math.max(...priced.map((row) => row.elapsedMs)) : null,
  });
}
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report.summary, null, 2));
const photos = [...new Set(report.results.map((row) => row.photo))];
console.log(JSON.stringify(photos.map((photo) => ({
  photo,
  low: report.results.filter((row) => row.photo === photo && row.thinkingLevel === 'low').map((row) => row.status === 'estimated' ? row.amountPhp : row.code ?? row.status),
  medium: report.results.filter((row) => row.photo === photo && row.thinkingLevel === 'medium').map((row) => row.status === 'estimated' ? row.amountPhp : row.code ?? row.status),
})), null, 2));
