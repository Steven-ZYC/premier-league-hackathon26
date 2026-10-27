import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { demoMatches } from "../shared/demos";
import {
  teamDisplayName,
  matchDisplayName,
  competitionDisplayName,
  sourceDisplayName,
  teamSecondaryName,
  matchMatchesQuery,
} from "../shared/names";
import { validateMatch, versionMatch } from "../shared/parser";
import { scoreAt } from "../shared/engine";
import { LanguageContext } from "../src/i18n";
import { Badge, Chart, StatsTable } from "../src/ui";

test("all demo teams, fixtures and competitions have explicit English display names", () => {
  const fixtures = [
    "Manchester United vs Tottenham Hotspur",
    "Chelsea vs Tottenham Hotspur",
    "FC Barcelona vs Athletic Club",
  ];
  demoMatches.forEach((match, index) => {
    assert.equal(matchDisplayName(match, "en"), fixtures[index]);
    assert.equal(
      competitionDisplayName(match, "en"),
      index === 2 ? "La Liga" : "Premier League",
    );
    for (const team of [match.home, match.away]) {
      assert.equal(teamDisplayName(team, "en"), team.englishName);
      assert.doesNotMatch(teamDisplayName(team, "en"), /\p{Script=Han}/u);
      assert.equal(teamDisplayName(team, "zh-CN"), team.name);
      assert.notEqual(
        teamSecondaryName(team, "en"),
        teamDisplayName(team, "en"),
      );
    }
    assert.doesNotMatch(sourceDisplayName(match, "en"), /\p{Script=Han}/u);
  });
});

test("imported names with no translation retain the original and blank translations fall back", () => {
  const match = structuredClone(demoMatches[0]);
  match.title = "我的比赛";
  delete match.englishTitle;
  match.competition = "学校联赛";
  match.englishCompetition = "   ";
  match.home.name = "青队";
  match.home.englishName = " ";
  assert.equal(matchDisplayName(match, "en"), "我的比赛");
  assert.equal(competitionDisplayName(match, "en"), "学校联赛");
  assert.equal(teamDisplayName(match.home, "en"), "青队");
});

test("search finds the same fixtures by Chinese, English, title, competition or team code", () => {
  const match = demoMatches[0];
  for (const query of [
    "曼联",
    " MANCHESTER UNITED ",
    "Tottenham",
    "MUN",
    "Premier League",
    match.englishTitle!,
  ])
    assert.equal(matchMatchesQuery(match, query), true, query);
  assert.equal(matchMatchesQuery(match, "Chelsea"), false);
});

test("JSON validation and export retain optional name translations across reloads", () => {
  const original = demoMatches[2];
  const imported = validateMatch(JSON.parse(JSON.stringify(original)));
  const reimported = validateMatch(JSON.parse(JSON.stringify(imported)));
  assert.equal(reimported.englishTitle, original.englishTitle);
  assert.equal(reimported.englishCompetition, original.englishCompetition);
  assert.equal(reimported.englishSource, original.englishSource);
  assert.equal(reimported.home.englishName, original.home.englishName);
  assert.equal(reimported.away.englishName, original.away.englishName);
  assert.equal(reimported.version, imported.version);
});

test("displaying translated names never mutates canonical events, score or input version", () => {
  const match = structuredClone(demoMatches[0]),
    before = JSON.stringify(match),
    score = scoreAt(match, 13),
    version = versionMatch(match);
  for (const language of ["en", "zh-CN", "zh-TW"] as const) {
    teamDisplayName(match.home, language);
    matchDisplayName(match, language);
    competitionDisplayName(match, language);
  }
  assert.equal(JSON.stringify(match), before);
  assert.deepEqual(scoreAt(match, 13), score);
  assert.equal(versionMatch(match), version);
});

test("English chart, statistics and badge markup use translated primary and accessible team names", () => {
  const match = demoMatches[0];
  for (const element of [
    React.createElement(Badge, { team: match.home }),
    React.createElement(Chart, { match, side: "home", cursor: 13 }),
    React.createElement(StatsTable, { match, cursor: 13 }),
  ]) {
    const markup = renderToStaticMarkup(
      React.createElement(LanguageContext.Provider, { value: "en" }, element),
    );
    assert.match(markup, /Manchester United/);
    assert.doesNotMatch(markup, /曼联|热刺/);
  }
});
