import assert from "node:assert/strict";
import test from "node:test";

import { adaptCityResults } from "./geocodingAdapter.js";

function createCity(overrides = {}) {
  return {
    id: 2735943,
    name: "Porto",
    country: "Portugal",
    admin1: "Porto",
    latitude: 41.14961,
    longitude: -8.61099,
    timezone: "Europe/Lisbon",
    ...overrides,
  };
}

test("projects the seven interface fields without mutating frozen API data", () => {
  const city = Object.freeze({ ...createCity(), population: 249633, country_code: "PT" });
  const response = Object.freeze({
    results: Object.freeze([city]),
    generationtime_ms: 0.5,
  });
  const locations = adaptCityResults(response);
  assert.deepEqual(locations, [createCity()]);
  assert.notEqual(locations, response.results);
  assert.notEqual(locations[0], city);
  assert.equal(city.population, 249633);
});

test("returns an empty array for omitted or empty results", () => {
  for (const response of [{}, { generationtime_ms: 0.2 }, { results: [] }]) {
    assert.deepEqual(adaptCityResults(response), []);
  }
});

test("preserves homonymous cities with their IDs, countries and regions", () => {
  const cities = [
    createCity({ id: 9, name: "Springfield", country: "United States", admin1: "Illinois" }),
    createCity({ id: 2, name: "Springfield", country: "United States", admin1: "Massachusetts" }),
    createCity({ id: 7, name: "Springfield", country: "Canada", admin1: "Nova Scotia" }),
  ];
  const locations = adaptCityResults({ results: cities });
  assert.deepEqual(locations, cities);
  assert.deepEqual(locations.map(({ id }) => id), [9, 2, 7]);
});

test("represents missing optional fields as null without inferring location metadata", () => {
  const city = { id: 1, name: "Example", latitude: 0, longitude: 0 };
  assert.deepEqual(adaptCityResults({ results: [city] }), [{
    ...city, country: null, admin1: null, timezone: null,
  }]);
  assert.equal(Object.hasOwn(city, "country"), false);
});

test("normalizes optional null or blank text to null and trims supplied text", () => {
  const response = { results: [createCity({
    name: " São Tomé ", country: " São Tomé and Príncipe ",
    admin1: " Água Grande ", timezone: " Africa/Sao_Tome ",
  })] };
  const [city] = adaptCityResults(response);
  assert.equal(city.name, "São Tomé");
  assert.equal(city.country, "São Tomé and Príncipe");
  assert.equal(city.admin1, "Água Grande");
  assert.equal(city.timezone, "Africa/Sao_Tome");
  assert.equal(response.results[0].name, " São Tomé ");

  for (const missing of [undefined, null, "", " \t "]) {
    const [location] = adaptCityResults({ results: [createCity({
      country: missing, admin1: missing, timezone: missing,
    })] });
    assert.equal(location.country, null);
    assert.equal(location.admin1, null);
    assert.equal(location.timezone, null);
  }
});

test("accepts zero and boundary coordinates without coercing their values", () => {
  for (const [latitude, longitude] of [[0, 0], [-90, -180], [90, 180]]) {
    const [city] = adaptCityResults({ results: [createCity({ latitude, longitude })] });
    assert.equal(city.latitude, latitude);
    assert.equal(city.longitude, longitude);
  }
});

test("rejects invalid response envelopes and API errors", () => {
  for (const response of [null, undefined, [], "invalid", 1, true]) {
    assert.throws(() => adaptCityResults(response), /response must be an object/);
  }
  for (const results of [null, {}, "invalid", 1]) {
    assert.throws(() => adaptCityResults({ results }), /results must be an array/);
  }
  assert.throws(
    () => adaptCityResults({ error: true, reason: "Invalid parameter" }),
    /API returned an error: Invalid parameter/,
  );
});

test("rejects invalid result entries and sparse arrays", () => {
  for (const city of [null, undefined, [], "Porto", 1]) {
    assert.throws(() => adaptCityResults({ results: [city] }), /results\[0\] must be an object/);
  }
  assert.throws(() => adaptCityResults({ results: new Array(1) }), /results\[0\] must be an object/);
});

test("requires a positive safe integer ID and rejects duplicate IDs", () => {
  for (const id of [undefined, null, "1", 0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(
      () => adaptCityResults({ results: [createCity({ id })] }),
      /results\[0\].id must be a positive safe integer/,
    );
  }
  assert.throws(
    () => adaptCityResults({ results: [createCity(), createCity()] }),
    /results\[1\].id duplicates location/,
  );
});

test("rejects missing, blank or non-string names", () => {
  for (const name of [undefined, null, "", "  ", 123, {}, []]) {
    assert.throws(
      () => adaptCityResults({ results: [createCity({ name })] }),
      /Invalid geocoding data: results\[0\].name/,
    );
  }
});

test("rejects invalid coordinates with the result index and field name", () => {
  for (const field of ["latitude", "longitude"]) {
    for (const value of [undefined, null, "0", false, NaN, Infinity, -Infinity]) {
      assert.throws(
        () => adaptCityResults({ results: [createCity({ [field]: value })] }),
        new RegExp(`results\\[0\\].${field} must be a finite number`),
      );
    }
  }
  for (const invalid of [{ latitude: 90.1 }, { latitude: -90.1 }, { longitude: 180.1 }, { longitude: -180.1 }]) {
    assert.throws(() => adaptCityResults({ results: [createCity(invalid)] }), /must be a finite number/);
  }
});

test("rejects malformed optional fields and unsupported timezones", () => {
  for (const field of ["country", "admin1", "timezone"]) {
    for (const value of [1, false, {}, []]) {
      assert.throws(
        () => adaptCityResults({ results: [createCity({ [field]: value })] }),
        new RegExp(`results\\[0\\].${field} must be a string`),
      );
    }
  }
  for (const timezone of ["Not/AZone", "Europe/Imaginary", "+01:00"]) {
    assert.throws(
      () => adaptCityResults({ results: [createCity({ timezone })] }),
      /results\[0\].timezone must be a supported IANA timezone/,
    );
  }
  for (const timezone of ["UTC", "Europe/Lisbon", "America/New_York"]) {
    assert.equal(adaptCityResults({ results: [createCity({ timezone })] })[0].timezone, timezone);
  }
});
