import express from "express";
import { join } from "node:path";
import { Express } from "express";
import * as utils from "../app/controllers/utils_controller";
import * as places from "../app/controllers/places_controller";
import * as outcodes from "../app/controllers/outcodes_controller";
import * as postcodes from "../app/controllers/postcodes_controller";
import * as scottishPostcodes from "../app/controllers/scottish_postcodes_controller";
import * as terminatedPostcodes from "../app/controllers/terminated_postcodes_controller";
import { Config } from "./config";
import { rateLimiters } from "./rateLimit";
import { apiCatalog, homepageLink } from "./well_known";

export const routes = (app: Express, config: Config): void => {
  // Per-IP rate limits on API routes only — health checks (/ping, /ready)
  // and static documentation are exempt. Bulk lookups get a stricter limit
  const { api: apiLimit, bulk: bulkLimit } = rateLimiters(config);

  const router = express.Router();
  router.get("/ping", utils.ping);
  router.get("/ready", utils.ready);

  router.get("/postcodes", apiLimit, postcodes.query);
  router.post("/postcodes", bulkLimit, postcodes.bulk);
  router.get("/postcodes/:postcode", apiLimit, postcodes.show);
  router.get("/postcodes/:postcode/nearest", apiLimit, postcodes.nearest);
  router.get("/postcodes/:postcode/validate", apiLimit, postcodes.valid);
  router.get(
    "/postcodes/:postcode/autocomplete",
    apiLimit,
    postcodes.autocomplete
  );
  router.get(
    "/postcodes/lon/:longitude/lat/:latitude",
    apiLimit,
    postcodes.lonlat
  );
  router.get(
    "/postcodes/lat/:latitude/lon/:longitude",
    apiLimit,
    postcodes.lonlat
  );

  router.get("/outcodes", apiLimit, outcodes.query);
  router.get("/outcodes/:outcode", apiLimit, outcodes.showOutcode);
  router.get("/outcodes/:outcode/nearest", apiLimit, outcodes.nearest);

  router.get("/places", apiLimit, places.query);
  router.get("/places/:id", apiLimit, places.show);

  router.get("/random/places", apiLimit, places.random);
  router.get("/random/postcodes", apiLimit, postcodes.random);

  router.get(
    "/terminated_postcodes/:postcode",
    apiLimit,
    terminatedPostcodes.show
  );

  router.get("/scotland/postcodes/:postcode", apiLimit, scottishPostcodes.show);

  const docsBuildPath = join(__dirname, "../../build");

  router.get("/.well-known/api-catalog", apiCatalog);
  router.get("/", homepageLink);
  router.use(express.static(docsBuildPath));

  app.use(config.urlPrefix, router);
};
