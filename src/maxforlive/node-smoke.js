const maxApi = require("max-api");

maxApi.post("[ableton-rack-node-smoke] loaded");

maxApi.addHandler("start", () => {
  maxApi.post("[ableton-rack-node-smoke] start requested");
});

maxApi.addHandler("anything", (...args) => {
  maxApi.post(`[ableton-rack-node-smoke] anything: ${args.join(" ")}`);
});
