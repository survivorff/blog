import type { CollectionEntry } from "astro:content";
import { SERIES, TRACK_ORDER, type SeriesMeta } from "@/data/series";
import postFilter from "./postFilter";

export type SeriesWithPosts = SeriesMeta & {
  posts: CollectionEntry<"blog">[];
  /** 系列内最新一篇的发布时间，用于排序 */
  latest: Date;
};

/**
 * 取出所有已注册且至少有一篇已发布文章的系列，
 * 每个系列内的文章按 series.order 升序排列。
 */
export const getAllSeries = (
  posts: CollectionEntry<"blog">[]
): SeriesWithPosts[] => {
  const published = posts.filter(postFilter);

  return SERIES.map(meta => {
    const seriesPosts = published
      .filter(p => p.data.series?.name === meta.name)
      .sort((a, b) => (a.data.series?.order ?? 0) - (b.data.series?.order ?? 0));

    const latest = seriesPosts.reduce<Date>((acc, p) => {
      const d = new Date(p.data.modDatetime ?? p.data.pubDatetime);
      return d > acc ? d : acc;
    }, new Date(0));

    return { ...meta, posts: seriesPosts, latest };
  }).filter(s => s.posts.length > 0);
};

/** 按赛道分组，赛道内按「最近更新」降序 */
export const groupSeriesByTrack = (series: SeriesWithPosts[]) => {
  const tracks = [...new Set(series.map(s => s.track))].sort((a, b) => {
    const ia = TRACK_ORDER.indexOf(a as (typeof TRACK_ORDER)[number]);
    const ib = TRACK_ORDER.indexOf(b as (typeof TRACK_ORDER)[number]);
    // 未在 TRACK_ORDER 中声明的赛道排在最后，按字母序
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  return tracks.map(track => ({
    track,
    series: series
      .filter(s => s.track === track)
      .sort((a, b) => b.latest.getTime() - a.latest.getTime()),
  }));
};

/**
 * 找出「文章里写了 series.name，但注册表里没有」的系列名。
 * 用于构建时告警，防止拼写不一致导致系列静默丢失。
 */
export const getUnregisteredSeriesNames = (
  posts: CollectionEntry<"blog">[]
): string[] => {
  const registered = new Set(SERIES.map(s => s.name));
  const used = new Set(
    posts
      .filter(postFilter)
      .map(p => p.data.series?.name)
      .filter((n): n is string => Boolean(n))
  );
  return [...used].filter(n => !registered.has(n));
};
