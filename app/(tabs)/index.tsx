import api, { assetUrl } from "@/lib/api";
import { cacheGet, cacheSet } from "@/lib/cache";
import { prefetchAll } from "@/lib/prefetch";
import { processSyncQueue, queueCount } from "@/lib/sync-queue";
import { tokenStore } from "@/lib/token";
import { projectStore, type Project } from "@/lib/store";
import * as Location from "expo-location";
import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

const weatherBackgrounds = {
  sunny: Image.resolveAssetSource(
    require("../../assets/images/weather-image/sunny.jpg"),
  ).uri,
  partly_cloudy: Image.resolveAssetSource(
    require("../../assets/images/weather-image/partly_cloudy.jpg"),
  ).uri,
  cloudy: Image.resolveAssetSource(
    require("../../assets/images/weather-image/cloudy.jpg"),
  ).uri,
  foggy: Image.resolveAssetSource(
    require("../../assets/images/weather-image/foggy.jpg"),
  ).uri,
  rainy: Image.resolveAssetSource(
    require("../../assets/images/weather-image/rainy.jpg"),
  ).uri,
  showers: Image.resolveAssetSource(
    require("../../assets/images/weather-image/showers.jpg"),
  ).uri,
  thunderstorm: Image.resolveAssetSource(
    require("../../assets/images/weather-image/thunderstorm.jpg"),
  ).uri,
  night: Image.resolveAssetSource(
    require("../../assets/images/weather-image/night.jpg"),
  ).uri,
  rainy_night: Image.resolveAssetSource(
    require("../../assets/images/weather-image/rainy-night.jpg"),
  ).uri,
  foggy_night: Image.resolveAssetSource(
    require("../../assets/images/weather-image/foggy-night.jpg"),
  ).uri,
  sunny_sunset: Image.resolveAssetSource(
    require("../../assets/images/weather-image/sunny-sunset.jpg"),
  ).uri,
};

const PRIMARY = "#0A5C3B";
const PRIMARY_DARK = "#064E33";
const PRIMARY_SOFT = "#DDEEE7";
const MINT = "#37A67A";
const SAGE = "#7AC7A7";
const DEEP_TEAL = "#0F766E";
const GOLD_SOFT = "#E8C56B";

const weatherIcons = {
  rain: Image.resolveAssetSource(
    require("../../assets/images/weather-icons/rainy.png"),
  ).uri,
  wind: Image.resolveAssetSource(
    require("../../assets/images/weather-icons/windy-night.png"),
  ).uri,
  humidity: Image.resolveAssetSource(
    require("../../assets/images/weather-icons/cloudy.png"),
  ).uri,
  uv: Image.resolveAssetSource(
    require("../../assets/images/weather-icons/sunny.png"),
  ).uri,
};

type WeatherCache = { data: any; city: string };

function buildHtml(
  lat: number | null,
  lon: number | null,
  bgMap: typeof weatherBackgrounds,
  iconMap: typeof weatherIcons,
  preloaded?: WeatherCache | null,
  userName?: string,
) {
  const fallbackHour = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }),
  ).getHours();

  const defaultVisual =
    fallbackHour >= 5 && fallbackHour < 10
      ? {
          bgKey: "partly_cloudy",
          icon: iconMap.uv,
          label: "Preparing morning weather...",
        }
      : fallbackHour >= 10 && fallbackHour < 17
        ? {
            bgKey: "sunny",
            icon: iconMap.uv,
            label: "Preparing daytime weather...",
          }
        : fallbackHour >= 17 && fallbackHour < 20
          ? {
              bgKey: "sunny_sunset",
              icon: iconMap.uv,
              label: "Preparing evening weather...",
            }
          : {
              bgKey: "night",
              icon: iconMap.wind,
              label: "Preparing night weather...",
            };

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
  />
  <title>PHT Flip Clock</title>

  <style>
    * {
      box-sizing: border-box;
      -webkit-font-smoothing: antialiased;
    }

    :root {
      --digit-width: clamp(31px, 8.8vw, 41px);
      --digit-height: clamp(43px, 12.5vw, 55px);
      --digit-font: clamp(25px, 7.2vw, 33px);
      --digit-radius: 12px;
      --pair-gap: clamp(6px, 1.8vw, 10px);
      --group-width: calc(var(--digit-width) * 2 + var(--pair-gap));
      --colon-width: clamp(8px, 2vw, 14px);
      --clock-gap: clamp(4px, 1vw, 8px);
      --pink: #37a67a;
      --violet: #0f766e;
      --peach: #e8c56b;
      --primary: #0A5C3B;
      --primary-dark: #064E33;
      --primary-soft: #DDEEE7;
      --text-light: #0A5C3B;
      --panel-top: #ffffff;
      --panel-bottom: #e9f5ef;
      --panel-border: #c7ddd2;
    }

    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      overflow-x: hidden;
      background: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
      color: white;
    }

    body {
      height: 100vh;
      overflow: hidden;
      padding: 8px;
      padding-top: 20px;
      display: flex;
      flex-direction: column;
    }

    .widget {
      width: 100%;
      max-width: 100%;
      padding: 16px;
      border-radius: 26px;
      position: relative;
      overflow: hidden;
      background: #ffffff;
      border: 1px solid rgba(255,255,255,0.06);
      box-shadow:
        0 14px 28px rgba(0,0,0,0.40),
        0 1px 0 rgba(255,255,255,0.04) inset;
    }

    .top-bar {
      margin-bottom: 8px;
    }

    .greeting-text {
      font-size: 25px;
      font-weight: 800;
      line-height: 1;
      letter-spacing: -1px;
      background: linear-gradient(90deg, #0A5C3B 0%, #37A67A 36%, #0F766E 72%, #E8C56B 100%);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }

    .name-text {
      font-size: 16px;
      font-weight: 700;
      color: var(--primary);
      margin-top: 4px;
    }

    .time-card {
      margin-top: 8px;
      padding: 12px;
      border-radius: 26px;
      position: relative;
      overflow: hidden;
      background: linear-gradient(135deg, rgba(255,255,255,0.98) 0%, #edf7f2 55%, #e0f1e9 100%);
      border: 1px solid rgba(10,92,59,0.10);
      box-shadow:
        0 14px 30px rgba(10,92,59,0.10),
        inset 0 1px 0 rgba(255,255,255,0.7);
    }

    .time-card:before {
      content: "";
      position: absolute;
      width: 160px;
      height: 160px;
      right: -40px;
      top: -50px;
      border-radius: 999px;
      background: radial-gradient(circle, rgba(55,166,122,0.18) 0%, rgba(55,166,122,0) 72%);
      pointer-events: none;
    }

    .time-card:after {
      content: "";
      position: absolute;
      width: 180px;
      height: 180px;
      left: -60px;
      bottom: -90px;
      border-radius: 999px;
      background: radial-gradient(circle, rgba(15,118,110,0.10) 0%, rgba(15,118,110,0) 72%);
      pointer-events: none;
    }

    .time-card-top {
      position: relative;
      z-index: 2;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
    }

    .time-card-title {
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: var(--primary);
    }

    .time-card-badge {
      padding: 7px 12px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #ffffff;
      background: linear-gradient(135deg, var(--primary), var(--violet));
      box-shadow: 0 8px 16px rgba(10,92,59,0.18);
    }

    .clock-area {
      position: relative;
      z-index: 2;
      width: 100%;
      display: grid;
      grid-template-columns:
        minmax(0, 1fr)
        var(--colon-width)
        minmax(0, 1fr)
        var(--colon-width)
        minmax(0, 1fr);
      justify-content: center;
      align-items: start;
      column-gap: var(--clock-gap);
      overflow: visible;
    }

    .unit {
      width: 100%;
      display: grid;
      grid-template-rows: auto auto;
      justify-items: center;
      row-gap: 6px;
      padding: 7px 5px 5px;
      border-radius: 18px;
      background: rgba(255,255,255,0.52);
      border: 1px solid rgba(10,92,59,0.07);
      backdrop-filter: blur(6px);
      min-width: 0;
    }

    .pair {
      width: 100%;
      display: grid;
      grid-template-columns: repeat(2, var(--digit-width));
      justify-content: center;
      column-gap: var(--pair-gap);
      align-items: center;
    }

    .label {
      box-shadow: 0 4px 10px rgba(10,92,59,0.16);

      font-size: 7px;
      font-weight: 900;
      letter-spacing: 1.2px;
      padding: 4px 8px;
      border-radius: 999px;
      color: #fff;
      background: linear-gradient(135deg, var(--primary), var(--violet));
      text-transform: uppercase;
      white-space: nowrap;
      line-height: 1;
      min-width: 74px;
      text-align: center;
      box-shadow: 0 6px 14px rgba(10,92,59,0.22);
    }

    .colon {
      margin-top: 10px;
      width: var(--colon-width);
      min-width: var(--colon-width);
      height: var(--digit-height);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: clamp(18px, 4vw, 24px);
      font-weight: 900;
      color: var(--primary);
      line-height: 1;
      text-align: center;
      text-shadow: none;
    }

    .nums {
      box-shadow: 0 8px 18px rgba(10,92,59,0.12);
      border-top: 1px solid rgba(255,255,255,0.95);
      display: inline-block;
      height: var(--digit-height);
      perspective: 1000px;
      position: relative;
      width: var(--digit-width);
      border-radius: var(--digit-radius);
      overflow: hidden;
      border: 1px solid rgba(10,92,59,0.08);
      background: linear-gradient(180deg, #ffffff 0%, #eef7f2 100%);
    }

    .nums:before {
      border-bottom: 1px solid rgba(10,92,59,0.12);
      content: "";
      height: 1px;
      left: 0;
      position: absolute;
      transform: translate3d(0, -1px, 0);
      top: 50%;
      width: 100%;
      z-index: 1000;
    }

    .nums:after {
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
      background: linear-gradient(180deg, #eff7f2 0%, var(--panel-bottom) 100%);
      border-bottom: 1px solid var(--panel-border);
      border-top: 1px solid rgba(255,255,255,0.85);
      border-radius: 0 0 var(--digit-radius) var(--digit-radius);
      bottom: 0;
      box-shadow: inset 0 10px 18px rgba(255,255,255,0.5);
      color: var(--text-light);
      content: attr(data-current);
      display: block;
      font-size: var(--digit-font);
      height: calc(50% - 1px);
      left: 0;
      line-height: 0;
      overflow: hidden;
      position: absolute;
      text-align: center;
      text-shadow: 0 1px 1px rgba(255,255,255,0.25);
      width: 100%;
      z-index: 0;
      font-weight: 900;
    }

    .num {
      animation-fill-mode: forwards;
      animation-iteration-count: infinite;
      animation-timing-function: ease-in;
      border-radius: var(--digit-radius);
      font-size: var(--digit-font);
      height: 100%;
      left: 0;
      position: absolute;
      transform: rotateX(0);
      transition: 0.6s;
      transform-style: preserve-3d;
      top: 0;
      width: 100%;
      font-weight: 900;
    }

    .num:before,
    .num:after {
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
      color: var(--text-light);
      display: block;
      height: 50%;
      left: 0;
      overflow: hidden;
      position: absolute;
      text-align: center;
      text-shadow: 0 1px 1px rgba(255,255,255,0.25);
      width: 100%;
      font-weight: 900;
    }

    .num:before {
      background: linear-gradient(180deg, #ffffff 0%, var(--panel-top) 100%);
      border-radius: var(--digit-radius) var(--digit-radius) 0 0;
      box-shadow: inset 0 10px 16px rgba(255,255,255,0.45);
      content: attr(data-num);
      line-height: 1.63;
      top: 0;
      z-index: 1;
    }

    .num:after {
      background: linear-gradient(180deg, #eff7f2 0%, var(--panel-bottom) 100%);
      border-bottom: 1px solid var(--panel-border);
      border-radius: 0 0 var(--digit-radius) var(--digit-radius);
      box-shadow: inset 0 10px 18px rgba(255,255,255,0.5);
      content: attr(data-num-next);
      height: calc(50% - 1px);
      line-height: 0;
      top: 0;
      transform: rotateX(180deg);
    }

    .num.current {
      opacity: 1;
      z-index: 2;
      transform: translateZ(1px);
    }

    .num.next {
      opacity: 1;
      z-index: 1;
      transform: translateZ(-1px);
    }

    .num.play {
      opacity: 1;
      z-index: 50;
      animation: flipDown 0.6s ease-in forwards;
    }

    @keyframes flipDown {
      0% { transform: rotateX(0); }
      100% { transform: rotateX(-180deg); }
    }

    .calendar-card {
      margin-top: 8px;
      padding: 12px;
      display: grid;
      gap: 8px;
      border-radius: 24px;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    }

    .calendar-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }

    .calendar-title {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 2.2px;
      color: #6b7280;
      text-transform: uppercase;
    }

    .calendar-pill {
      padding: 8px 14px;
      border-radius: 999px;
      background: linear-gradient(135deg, var(--primary), var(--violet));
      color: #fff;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 1px;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .calendar-body {
      display: grid;
      grid-template-columns: 76px 1fr;
      gap: 8px;
      align-items: stretch;
    }

    .calendar-date-block,
    .calendar-details {
      border-radius: 16px;
      padding: 8px;
      background: #f4f6f9;
      border: 1px solid #e5e7eb;
    }

    .calendar-date-block {
      display: grid;
      gap: 8px;
      align-content: center;
      text-align: center;
    }

    .calendar-month {
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 1.8px;
      color: var(--primary);
    }

    .calendar-number {
      font-size: 29px;
      line-height: 1;
      font-weight: 900;
      color: var(--violet);
      letter-spacing: -1px;
    }

    .calendar-details {
      display: grid;
      gap: 8px;
      align-content: center;
    }

    .calendar-day {
      font-size: 15px;
      font-weight: 900;
      color: #0d1117;
    }

    .calendar-full-date {
      font-size: 12px;
      font-weight: 700;
      color: #6b7280;
    }

    .calendar-note {
      font-size: 11px;
      font-weight: 800;
      color: var(--violet);
    }

    .weather-card {
      margin-top: 8px;
      border-radius: 20px;
      overflow: hidden;
      position: relative;
      flex: 1;
      min-height: 140px;
      background: #ffffff;
      box-shadow: 0 10px 24px rgba(0,0,0,0.18);
    }

    .weather-bg {
      position: absolute;
      inset: 0;
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      transform: scale(1.02);
    }

    .weather-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(6,78,51,0.16) 0%, rgba(6,78,51,0.28) 45%, rgba(6,78,51,0.48) 100%);
    }

    .weather-loading {
      position: relative;
      z-index: 2;
      padding: 16px 14px;
      text-align: center;
      font-size: 13px;
      font-weight: 600;
      color: rgba(255,255,255,0.96);
    }

    #weather-content {
      position: relative;
      z-index: 2;
      display: none;
      flex-direction: column;
      justify-content: space-between;
      min-height: 145px;
      padding: 10px;
    }

    .weather-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .weather-location-wrap {
      flex: 1;
      min-width: 0;
    }

    .weather-city {
      font-size: 18px;
      font-weight: 800;
      color: #ffffff;
      line-height: 1.1;
    }

    .weather-condition {
      font-size: 12px;
      font-weight: 600;
      color: rgba(255,255,255,0.78);
      margin-top: 5px;
    }

    .weather-main-icon-wrap {
      position: absolute;
      right: 40px;
      top: 28px;
      width: 60px;
      height: 70px;
      pointer-events: none;
    }

    .weather-main-icon {
      width: 100%;
      height: 100%;
      object-fit: contain;
      transform: scale(2.2);
      transform-origin: center;
      filter: drop-shadow(0 6px 14px rgba(0,0,0,0.25));
    }

    .weather-main {
      margin-top: 12px;
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 14px;
    }

    .weather-temp-wrap {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .weather-temp-big {
      font-size: 58px;
      font-weight: 900;
      line-height: 0.95;
      color: #ffffff;
      letter-spacing: -2px;
      text-shadow: none;
    }

    .weather-advisory {
      font-size: 12px;
      font-weight: 700;
      color: #4b5563;
      max-width: 220px;
      text-align: right;
      line-height: 1.35;
    }

    .weather-stats-min {
      margin-top: 18px;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }

    .stat-row {
      border-radius: 999px;
      background: transparent;
      border: 1px solid #edf2f7;
      box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06);
      color:#edf2f7;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 1px 5px;
      text-align: center;
    }

    .stat-left {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    .stat-icon {
      width: 18px;
      height: 18px;
      object-fit: contain;
      opacity: 0.98;
      flex-shrink: 0;
    }

    .stat-label {
      font-size: 12px;
      font-weight: 700;
      color: rgba(255,255,255,0.82);
      letter-spacing: 0.2px;
    }

    .stat-value {
      font-size: 13px;
      font-weight: 900;
      color: #fff;
      flex-shrink: 0;
    }

    .stat-right-dual {
      display: flex;
      align-items: center;
      gap: 14px;
      flex-shrink: 0;
    }

    .mini-pair {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .mini-icon {
      width: 16px;
      height: 16px;
      object-fit: contain;
      opacity: 0.96;
    }

    .mini-text {
      font-size: 13px;
      font-weight: 900;
      color: #fff;
    }
  </style>
</head>
<body>
  <div class="widget">
    <div class="top-bar">
      <div class="greeting-text" id="greeting-text">Good Morning</div>
      <div class="name-text">${userName ?? "User"}</div>
    </div>

    <div class="time-card">
      <div class="time-card-top">
        <div class="time-card-title">Philippine Standard Time</div>
        <div class="time-card-badge">Live</div>
      </div>

      <div class="clock-area">
      <div class="unit">
        <div class="pair">
          <div class="nums" id="hour-tens" data-current="0"></div>
          <div class="nums" id="hour-ones" data-current="0"></div>
        </div>
        <div class="label">Hours</div>
      </div>

      <div class="colon">:</div>

      <div class="unit">
        <div class="pair">
          <div class="nums" id="minute-tens" data-current="0"></div>
          <div class="nums" id="minute-ones" data-current="0"></div>
        </div>
        <div class="label">Minutes</div>
      </div>

      <div class="colon">:</div>

      <div class="unit">
        <div class="pair">
          <div class="nums" id="second-tens" data-current="0"></div>
          <div class="nums" id="second-ones" data-current="0"></div>
        </div>
        <div class="label">Seconds</div>
      </div>
    </div>
    </div>

    <div class="calendar-card">
      <div class="calendar-header">
        <div class="calendar-title">PHT Calendar</div>
        <div class="calendar-pill">Asia/Manila</div>
      </div>

      <div class="calendar-body">
        <div class="calendar-date-block">
          <div class="calendar-month" id="calendar-month">MARCH</div>
          <div class="calendar-number" id="calendar-number">22</div>
        </div>

        <div class="calendar-details">
          <div class="calendar-day" id="calendar-day">SUNDAY</div>
          <div class="calendar-full-date" id="calendar-full-date">March 22, 2026</div>
          <div class="calendar-note">Make today productive</div>
        </div>
      </div>
    </div>

    <div class="weather-card" id="weather-card">
      <div class="weather-bg" id="weather-bg"></div>
      <div class="weather-overlay"></div>
      <div class="weather-loading" id="weather-loading">${defaultVisual.label}</div>

      <div id="weather-content">
        <div>
          <div class="weather-head">
            <div class="weather-location-wrap">
              <div class="weather-city" id="w-city">—</div>
              <div class="weather-condition" id="w-condition">—</div>
            </div>
            <div class="weather-main-icon-wrap">
              <img id="w-main-icon" class="weather-main-icon" src="" alt="weather icon" />
            </div>
          </div>

          <div class="weather-main">
            <div class="weather-temp-wrap">
              <div class="weather-temp-big" id="w-temp">—°</div>
            </div>
            <div class="weather-advisory" id="w-advisory">—</div>
          </div>
        </div>

        <div class="weather-stats-min">
          <div class="stat-row">
            <div class="stat-left">
              <img class="stat-icon" src="${iconMap.rain}" alt="rain" />
              <div class="stat-label">Rain chance</div>
            </div>
            <div class="stat-value" id="w-rain">—</div>
          </div>

          <div class="stat-row">
            <div class="stat-left">
              <img class="stat-icon" src="${iconMap.wind}" alt="wind" />
              <div class="stat-label">Wind speed</div>
            </div>
            <div class="stat-value" id="w-wind">—</div>
          </div>

          <div class="stat-row">
            <div class="stat-left">
              <img class="stat-icon" src="${iconMap.humidity}" alt="humidity" />
              <div class="stat-label">Humidity / UV</div>
            </div>
            <div class="stat-right-dual">
              <div class="mini-pair">
                <img class="mini-icon" src="${iconMap.humidity}" alt="humidity" />
                <div class="mini-text" id="w-humidity">—</div>
              </div>
              <div class="mini-pair">
                <img class="mini-icon" src="${iconMap.uv}" alt="uv" />
                <div class="mini-text" id="w-uv">—</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    const WEATHER_BACKGROUNDS = ${JSON.stringify(bgMap)};
    const WEATHER_ICONS = ${JSON.stringify(iconMap)};

    const deckIds = [
      "hour-tens",
      "hour-ones",
      "minute-tens",
      "minute-ones",
      "second-tens",
      "second-ones"
    ];

    const decks = Object.fromEntries(
      deckIds.map(id => [id, document.getElementById(id)])
    );

    const greetingText = document.getElementById("greeting-text");
    const calendarMonth = document.getElementById("calendar-month");
    const calendarNumber = document.getElementById("calendar-number");
    const calendarDay = document.getElementById("calendar-day");
    const calendarFullDate = document.getElementById("calendar-full-date");

    function createDigitCards(deck) {
      if (!deck) return;
      let html = "";
      for (let i = 0; i <= 9; i++) {
        const next = (i + 1) % 10;
        html += '<div class="num" data-num="' + i + '" data-num-next="' + next + '"></div>';
      }
      deck.innerHTML = html;
    }

    deckIds.forEach(id => createDigitCards(decks[id]));

    function getCards(deck) {
      if (!deck) return [];
      return Array.from(deck.querySelectorAll(".num"));
    }

    function clearDeckClasses(deck) {
      const cards = getCards(deck);
      cards.forEach(card => {
        card.classList.remove("current", "next", "play");
      });
    }

    function showDigit(deck, digit) {
      if (!deck) return;
      const value = String(digit);
      const cards = getCards(deck);

      cards.forEach(card => {
        card.classList.remove("current", "next", "play");
      });

      const activeCard = cards.find(card => card.dataset.num === value);
      if (activeCard) {
        activeCard.classList.add("current");
        deck.setAttribute("data-current", value);
        deck.dataset.animating = "false";
      }
    }

    function flipTo(deck, nextDigit) {
      if (!deck) return;
      const next = String(nextDigit);
      const current = deck.getAttribute("data-current");
      const animating = deck.dataset.animating === "true";

      if (!current) {
        showDigit(deck, next);
        return;
      }

      if (current === next || animating) return;

      const cards = getCards(deck);
      const currentCard = cards.find(card => card.dataset.num === current);
      const nextCard = cards.find(card => card.dataset.num === next);

      if (!currentCard || !nextCard) {
        showDigit(deck, next);
        return;
      }

      deck.dataset.animating = "true";

      cards.forEach(card => {
        card.classList.remove("next", "play");
      });

      nextCard.classList.add("next");
      currentCard.setAttribute("data-num-next", next);
      currentCard.classList.add("play");

      currentCard.addEventListener(
        "animationend",
        () => {
          clearDeckClasses(deck);
          nextCard.classList.add("current");
          deck.setAttribute("data-current", next);
          deck.dataset.animating = "false";
        },
        { once: true }
      );
    }

    function getPhilippineDateTime() {
      const now = new Date();

      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Manila",
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
      }).formatToParts(now);

      const hour24 = parseInt(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Manila",
          hour: "2-digit",
          hour12: false
        }).format(now),
        10
      );

      const get = type => parts.find(part => part.type === type)?.value || "";

      const hour = get("hour");
      const minute = get("minute");
      const second = get("second");
      const weekday = get("weekday");
      const month = get("month");
      const day = get("day");
      const year = get("year");

      return {
        hourTens: hour[0],
        hourOnes: hour[1],
        minuteTens: minute[0],
        minuteOnes: minute[1],
        secondTens: second[0],
        secondOnes: second[1],
        weekday,
        month,
        day,
        year,
        hour24
      };
    }

    function updateGreeting(info) {
      if (!greetingText) return;
      let greeting = "Good Evening";
      if (info.hour24 >= 5 && info.hour24 < 12) greeting = "Good Morning";
      else if (info.hour24 >= 12 && info.hour24 < 18) greeting = "Good Afternoon";
      greetingText.textContent = greeting;
    }

    function updateCalendar(info) {
      if (calendarMonth) calendarMonth.textContent = info.month.toUpperCase();
      if (calendarNumber) calendarNumber.textContent = String(parseInt(info.day, 10));
      if (calendarDay) calendarDay.textContent = info.weekday.toUpperCase();
      if (calendarFullDate) {
        calendarFullDate.textContent = info.month + " " + parseInt(info.day, 10) + ", " + info.year;
      }
    }

    function updateClock(initial = false) {
      const info = getPhilippineDateTime();

      if (initial) {
        showDigit(decks["hour-tens"], info.hourTens);
        showDigit(decks["hour-ones"], info.hourOnes);
        showDigit(decks["minute-tens"], info.minuteTens);
        showDigit(decks["minute-ones"], info.minuteOnes);
        showDigit(decks["second-tens"], info.secondTens);
        showDigit(decks["second-ones"], info.secondOnes);
      } else {
        flipTo(decks["hour-tens"], info.hourTens);
        flipTo(decks["hour-ones"], info.hourOnes);
        flipTo(decks["minute-tens"], info.minuteTens);
        flipTo(decks["minute-ones"], info.minuteOnes);
        flipTo(decks["second-tens"], info.secondTens);
        flipTo(decks["second-ones"], info.secondOnes);
      }

      updateCalendar(info);
      updateGreeting(info);
    }

    function syncToNextSecond() {
      const now = Date.now();
      const delay = 1000 - (now % 1000) + 20;
      setTimeout(() => {
        updateClock(false);
        syncToNextSecond();
      }, delay);
    }

    updateClock(true);
    syncToNextSecond();

    const WMO_LABEL = {
      0:"Clear Sky",1:"Mainly Clear",2:"Partly Cloudy",3:"Overcast",
      45:"Foggy",48:"Foggy",51:"Light Drizzle",53:"Drizzle",55:"Heavy Drizzle",
      61:"Light Rain",63:"Rain",65:"Heavy Rain",71:"Snow",73:"Snow",75:"Heavy Snow",
      80:"Rain Showers",81:"Rain Showers",82:"Heavy Showers",
      95:"Thunderstorm",96:"Thunderstorm",99:"Thunderstorm"
    };

    function getWeatherAssetKey(code, isDay) {
      if ([95,96,99].includes(code)) return "thunderstorm";
      if ([80,81,82].includes(code)) return isDay ? "showers" : "rainy_night";
      if ([51,53,55,61,63,65].includes(code)) return isDay ? "rainy" : "rainy_night";
      if ([45,48].includes(code)) return isDay ? "foggy" : "foggy_night";
      if (code === 0) return isDay ? "sunny" : "night";
      if (code === 1 || code === 2) return isDay ? "partly_cloudy" : "night";
      if (code === 3) return "cloudy";
      return isDay ? "sunny" : "night";
    }

    function getMainIcon(code, isDay) {
      if ([95,96,99].includes(code)) return WEATHER_ICONS.uv;
      if ([80,81,82,51,53,55,61,63,65].includes(code)) return WEATHER_ICONS.rain;
      if ([45,48,3].includes(code)) return WEATHER_ICONS.humidity;
      if (isDay) return WEATHER_ICONS.uv;
      return WEATHER_ICONS.wind;
    }

    function getAdvisory(code, rain, wind, uv) {
      if ([95,96,99].includes(code)) return "Thunderstorm risk";
      if (rain >= 70) return "High rain chance";
      if (wind >= 40) return "Strong winds";
      if (uv >= 8) return "High UV today";
      return "Good field conditions";
    }

    function showWeather(data, city) {
      if (!data || !data.current) {
        const loading = document.getElementById("weather-loading");
        if (loading) loading.textContent = "⚠️ Weather unavailable";
        return;
      }

      const c = data.current;
      const code = c.weather_code;
      const isDay = c.is_day === 1;

      const cityEl = document.getElementById("w-city");
      const conditionEl = document.getElementById("w-condition");
      const tempEl = document.getElementById("w-temp");
      const rainEl = document.getElementById("w-rain");
      const windEl = document.getElementById("w-wind");
      const humidityEl = document.getElementById("w-humidity");
      const uvEl = document.getElementById("w-uv");
      const advisoryEl = document.getElementById("w-advisory");
      const loadingEl = document.getElementById("weather-loading");
      const contentEl = document.getElementById("weather-content");
      const weatherBgEl = document.getElementById("weather-bg");
      const mainIconEl = document.getElementById("w-main-icon");

      const assetKey = getWeatherAssetKey(code, isDay);
      const bgUrl = WEATHER_BACKGROUNDS[assetKey] || WEATHER_BACKGROUNDS.sunny;
      const iconUrl = getMainIcon(code, isDay);

      if (cityEl) cityEl.textContent = city;
      if (conditionEl) conditionEl.textContent = WMO_LABEL[code] || "—";
      if (tempEl) tempEl.textContent = Math.round(c.temperature_2m) + "°C";
      if (rainEl) rainEl.textContent = (c.precipitation_probability ?? 0) + "%";
      if (windEl) windEl.textContent = Math.round(c.wind_speed_10m ?? 0) + " km/h";
      if (humidityEl) humidityEl.textContent = (c.relative_humidity_2m ?? 0) + "%";
      if (uvEl) uvEl.textContent = Math.round(c.uv_index ?? 0) + "";
      if (advisoryEl) {
        advisoryEl.textContent = getAdvisory(
          code,
          c.precipitation_probability ?? 0,
          c.wind_speed_10m ?? 0,
          c.uv_index ?? 0
        );
      }

      if (weatherBgEl) {
        weatherBgEl.style.backgroundImage = 'url("' + bgUrl + '")';
      }

      if (mainIconEl) {
        mainIconEl.src = iconUrl;
      }

      if (loadingEl) loadingEl.style.display = "none";
      if (contentEl) contentEl.style.display = "flex";
    }

    

    (function() {
      var lat = ${lat ?? "null"};
      var lon = ${lon ?? "null"};
      var preloaded = ${preloaded ? JSON.stringify(preloaded) : "null"};
      var loadingEl = document.getElementById("weather-loading");
      var bgEl = document.getElementById("weather-bg");
      var iconEl = document.getElementById("w-main-icon");

      if (bgEl) bgEl.style.backgroundImage = 'url("' + WEATHER_BACKGROUNDS["${defaultVisual.bgKey}"] + '")';
      if (iconEl) iconEl.src = "${defaultVisual.icon}";

      if (preloaded && preloaded.data && preloaded.city) {
        showWeather(preloaded.data, preloaded.city);
      } else if (lat === null || lon === null) {
        if (loadingEl) loadingEl.textContent = "Using saved local weather view...";
        return;
      } else {
        if (loadingEl) loadingEl.textContent = "Refreshing local weather...";
      }

      if (lat === null || lon === null) return;
      fetch(
        "https://nominatim.openstreetmap.org/reverse?lat=" + lat + "&lon=" + lon + "&format=json",
        { headers: { "Accept-Language": "en", "User-Agent": "TelcoVantage/1.0" } }
      )
        .then(function(r) { return r.json(); })
        .then(function(geo) {
          var city = (geo.address && (geo.address.city || geo.address.town || geo.address.village || geo.address.county)) || "Your Location";
          return fetch(
            "https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lon +
            "&current=temperature_2m,relative_humidity_2m,precipitation_probability,weather_code,wind_speed_10m,uv_index,is_day&wind_speed_unit=kmh&timezone=auto"
          ).then(function(r) { return r.json(); }).then(function(data) { showWeather(data, city); });
        })
        .catch(function() {
          if (!preloaded) {
            if (loadingEl) loadingEl.textContent = "⚠️ Weather unavailable";
          }
        });
    })();

  </script>
</body>
</html>
`;
}

function getStatusColors(status: string) {
  switch (status) {
    case "Priority":
      return {
        heroBase: PRIMARY,
        heroOverlay: DEEP_TEAL,
        pillBg: "#E4F6EE",
        pillText: PRIMARY,
        buttonBg: PRIMARY,
        accent: GOLD_SOFT,
        line: "#D8E9E0",
        icon: "⚠️",
      };
    case "In Progress":
      return {
        heroBase: PRIMARY,
        heroOverlay: MINT,
        pillBg: "#E4F6EE",
        pillText: PRIMARY_DARK,
        buttonBg: PRIMARY,
        accent: SAGE,
        line: "#D6EEE3",
        icon: "⚡",
      };
    case "Ongoing":
      return {
        heroBase: DEEP_TEAL,
        heroOverlay: PRIMARY,
        pillBg: "#DCF7EE",
        pillText: PRIMARY,
        buttonBg: PRIMARY,
        accent: MINT,
        line: "#D5EFE7",
        icon: "🛠️",
      };
    case "Pending":
      return {
        heroBase: PRIMARY,
        heroOverlay: "#2B8C66",
        pillBg: "#FFF6D9",
        pillText: "#9A6A00",
        buttonBg: PRIMARY,
        accent: GOLD_SOFT,
        line: "#EFE5C3",
        icon: "📋",
      };
    case "Queued":
    default:
      return {
        heroBase: PRIMARY_DARK,
        heroOverlay: PRIMARY,
        pillBg: PRIMARY_SOFT,
        pillText: PRIMARY,
        buttonBg: PRIMARY,
        accent: SAGE,
        line: "#D8E9E0",
        icon: "🗂️",
      };
  }
}

function ProjectCard({ item }: { item: Project }) {
  const colors = getStatusColors(item.status);

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: `${colors.accent}14`,
          shadowColor: colors.accent,
        },
      ]}
    >
      <View
        style={[
          styles.cardTopHighlight,
          { backgroundColor: `${colors.accent}18` },
        ]}
      />

      <View style={styles.cardHero}>
        <View
          style={[
            styles.cardHeroGradientBase,
            { backgroundColor: colors.heroBase },
          ]}
        />
        <View
          style={[
            styles.cardHeroOverlay,
            { backgroundColor: colors.heroOverlay },
          ]}
        />

        <View style={styles.gridOverlay}>
          {Array.from({ length: 40 }).map((_, index) => (
            <View key={index} style={styles.gridSquare} />
          ))}
        </View>

        <View style={styles.glowOrbLeft} />
        <View style={styles.glowOrbRight} />

        {assetUrl(item.project_logo) ? (
          <Image
            source={{ uri: assetUrl(item.project_logo)! }}
            style={styles.cardHeroFullBgLogo}
            resizeMode="cover"
          />
        ) : (
          <Text style={styles.cardHeroWatermark}>{colors.icon}</Text>
        )}
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>
          {String(item.project_name || "").toUpperCase()}
        </Text>
        <Text style={styles.cardDesc}>Project Code: {item.project_code}</Text>

        <View style={[styles.cardDivider, { backgroundColor: colors.line }]} />

        <View style={styles.metaRow}>
          <View
            style={[
              styles.infoPill,
              {
                backgroundColor: colors.pillBg,
                borderColor: `${colors.accent}18`,
              },
            ]}
          >
            <Text style={[styles.infoPillLabel, { color: colors.pillText }]}>
              Status
            </Text>
            <Text style={[styles.infoPillValue, { color: colors.pillText }]}>
              {item.status}
            </Text>
          </View>

          <View
            style={[styles.infoPill, { borderColor: `${colors.accent}12` }]}
          >
            <Text style={styles.infoPillLabel}>Client</Text>
            <Text style={styles.infoPillValue} numberOfLines={1}>
              {item.client}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.cardButton}
          onPress={() => router.push(`/projects/${item.id}` as any)}
        >
          <View
            style={[styles.cardButtonBg, { backgroundColor: colors.buttonBg }]}
          />
          <Text style={styles.cardButtonText}>View Project</Text>
          <Text style={styles.cardButtonArrow}>→</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function Index() {
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // 49 = standard tab bar height, insets.bottom = safe area below tab bar
  const TAB_BAR_H = 49 + insets.bottom;
  const SHEET_HEIGHT = Math.min(Math.max(screenHeight * 0.72, 560), 720);
  const SHEET_WIDTH = screenWidth - 24;
  // 108px visible above the tab bar
  const COLLAPSED_VISIBLE = 102 + TAB_BAR_H;

  const collapsedTop = screenHeight - COLLAPSED_VISIBLE - 24;
  const expandedTop = Math.max((screenHeight - SHEET_HEIGHT) / 2, 84);

  const expandedTranslateY = expandedTop - collapsedTop;
  const collapsedTranslateY = 0;

  const translateY = useRef(new Animated.Value(collapsedTranslateY)).current;
  const cardsOpacity = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const preloadSlideY = useRef(new Animated.Value(18)).current;
  const preloadOpacity = useRef(new Animated.Value(0)).current;
  const swipeHintTranslateY = useRef(new Animated.Value(12)).current;
  const swipeHintOpacity = useRef(new Animated.Value(0.7)).current;

  const dragStart = useRef(collapsedTranslateY);
  const [isExpanded, setIsExpanded] = useState(false);
  const [projects, setProjects] = useState<Project[]>(() => projectStore.get());
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(
    null,
  );
  const [weatherCache, setWeatherCache] = useState<WeatherCache | null>(null);
  const [userName, setUserName] = useState("User");

  useEffect(() => {
    tokenStore.getUser().then((u: any) => {
      const first = u?.first_name ?? "";
      const last = u?.last_name ?? "";
      const name = `${first} ${last}`.trim();
      if (name) setUserName(name);
    });
  }, []);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const syncSpin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    cacheGet<number>("last_synced").then((ts) => { if (ts) setLastSynced(ts); });
    queueCount().then(setPendingCount);
  }, []);

  useEffect(() => {
    if (!syncing) { syncSpin.setValue(0); return; }
    Animated.loop(
      Animated.timing(syncSpin, { toValue: 1, duration: 800, easing: Easing.linear, useNativeDriver: true }),
    ).start();
    return () => syncSpin.stopAnimation();
  }, [syncing]);

  function formatLastSynced(ts: number | null): string {
    if (!ts) return "Never synced";
    const min = Math.floor((Date.now() - ts) / 60000);
    if (min < 1) return "Just synced";
    if (min < 60) return `Synced ${min}m ago`;
    const h = Math.floor(min / 60);
    if (h < 24) return `Synced ${h}h ago`;
    return `Synced ${Math.floor(h / 24)}d ago`;
  }

  async function handleSync() {
    if (syncing) return;
    setSyncing(true);
    await Promise.allSettled([prefetchAll(), processSyncQueue()]);
    const now = Date.now();
    await cacheSet("last_synced", now);
    setLastSynced(now);
    queueCount().then(setPendingCount);
    setSyncing(false);
  }

  const webViewHtml = useMemo(
    () =>
      buildHtml(
        coords?.lat ?? null,
        coords?.lon ?? null,
        weatherBackgrounds,
        weatherIcons,
        weatherCache,
        userName,
      ),
    [coords?.lat, coords?.lon, weatherCache, userName],
  );

  useEffect(() => {
    Animated.parallel([
      Animated.timing(preloadOpacity, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(preloadSlideY, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(swipeHintTranslateY, {
              toValue: -12,
              duration: 850,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(swipeHintOpacity, {
              toValue: 1,
              duration: 420,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(swipeHintTranslateY, {
              toValue: 10,
              duration: 850,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(swipeHintOpacity, {
              toValue: 0.42,
              duration: 420,
              useNativeDriver: true,
            }),
          ]),
        ]),
      ),
    ]).start();
  }, [preloadOpacity, preloadSlideY, swipeHintOpacity, swipeHintTranslateY]);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;

        const last = await Location.getLastKnownPositionAsync({
          maxAge: 300000,
        }).catch(() => null);
        if (last) {
          setCoords({ lat: last.coords.latitude, lon: last.coords.longitude });
          return;
        }

        const loc = await Promise.race([
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Highest,
          }),
          new Promise<null>((res) => setTimeout(() => res(null), 60000)),
        ]);
        if (loc)
          setCoords({ lat: loc.coords.latitude, lon: loc.coords.longitude });
      } catch {
        // non-blocking
      }
    })();
  }, []);

  useEffect(() => {
    cacheGet<WeatherCache>("weather_data").then((cached) => {
      if (cached) setWeatherCache(cached);
    });
  }, []);

  useEffect(() => {
    if (!coords) return;
    const { lat, lon } = coords;
    fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      {
        headers: { "Accept-Language": "en", "User-Agent": "TelcoVantage/1.0" },
      },
    )
      .then((r) => r.json())
      .then((geo) => {
        const city =
          geo.address?.city ??
          geo.address?.town ??
          geo.address?.village ??
          geo.address?.county ??
          "Your Location";
        return fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
            `&current=temperature_2m,relative_humidity_2m,precipitation_probability,weather_code,wind_speed_10m,uv_index,is_day` +
            `&wind_speed_unit=kmh&timezone=auto`,
        )
          .then((r) => r.json())
          .then((data) => {
            const w: WeatherCache = { data, city };
            cacheSet("weather_data", w);
            setWeatherCache(w);
          });
      })
      .catch(() => {});
  }, [coords?.lat, coords?.lon]);

  useEffect(() => {
    if (projectStore.get().length === 0) {
      cacheGet<Project[]>("projects_list").then((cached) => {
        if (cached?.length) {
          projectStore.set(cached);
          setProjects(cached);
        }
      });
    }

    api
      .get("/projects")
      .then(({ data }) => {
        const list: Project[] = Array.isArray(data) ? data : [];
        cacheSet("projects_list", list);
        projectStore.set(list);
        setProjects(list);
      })
      .catch(() => {});
  }, []);

  const titleTranslateY = translateY.interpolate({
    inputRange: [expandedTranslateY, collapsedTranslateY],
    outputRange: [0, 8],
    extrapolate: "clamp",
  });

  const titleScale = translateY.interpolate({
    inputRange: [expandedTranslateY, collapsedTranslateY],
    outputRange: [1, 0.97],
    extrapolate: "clamp",
  });

  const titleOpacity = translateY.interpolate({
    inputRange: [expandedTranslateY, collapsedTranslateY],
    outputRange: [1, 0.92],
    extrapolate: "clamp",
  });

  const subOpacity = translateY.interpolate({
    inputRange: [expandedTranslateY, collapsedTranslateY],
    outputRange: [1, 0.78],
    extrapolate: "clamp",
  });

  const sheetLift = translateY.interpolate({
    inputRange: [expandedTranslateY, collapsedTranslateY],
    outputRange: [1, 0.986],
    extrapolate: "clamp",
  });

  const animateCards = (show: boolean) => {
    Animated.parallel([
      Animated.timing(cardsOpacity, {
        toValue: show ? 1 : 0,
        duration: show ? 280 : 160,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: show ? 0.16 : 0,
        duration: show ? 280 : 160,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const animateTo = (toValue: number) => {
    const opening = toValue === expandedTranslateY;

    Animated.spring(translateY, {
      toValue,
      useNativeDriver: true,
      tension: 62,
      friction: 10,
    }).start();

    setIsExpanded(opening);
    dragStart.current = toValue;
    animateCards(opening);
  };

  useEffect(() => {
    animateTo(collapsedTranslateY);
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dy) > 8,
        onPanResponderGrant: () => {
          translateY.stopAnimation((value: number) => {
            dragStart.current = value;
          });
        },
        onPanResponderMove: (_, gestureState) => {
          const next = dragStart.current + gestureState.dy;
          const clamped = Math.max(
            expandedTranslateY,
            Math.min(collapsedTranslateY, next),
          );
          translateY.setValue(clamped);
        },
        onPanResponderRelease: (_, gestureState) => {
          const finalValue = dragStart.current + gestureState.dy;
          const midpoint = (collapsedTranslateY + expandedTranslateY) / 2;

          if (gestureState.dy < -25) {
            animateTo(expandedTranslateY);
            return;
          }

          if (gestureState.dy > 25) {
            animateTo(collapsedTranslateY);
            return;
          }

          if (finalValue < midpoint) {
            animateTo(expandedTranslateY);
          } else {
            animateTo(collapsedTranslateY);
          }
        },
      }),
    [collapsedTranslateY, expandedTranslateY, translateY],
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.webviewWrap}>
        <WebView
          originWhitelist={["*"]}
          source={{ html: webViewHtml }}
          scalesPageToFit={false}
          style={styles.webview}
          scrollEnabled={false}
          bounces={false}
          showsVerticalScrollIndicator={false}
          backgroundColor="#ffffff"
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="always"
        />

        {/* Manual sync button — top-right of greeting */}
        <View style={styles.syncWrapper}>
          <TouchableOpacity
            onPress={handleSync}
            disabled={syncing}
            activeOpacity={0.75}
            style={styles.syncBtn}
          >
            {syncing ? (
              <ActivityIndicator size={16} color="#0A5C3B" />
            ) : (
              <Animated.Text
                style={[
                  styles.syncIcon,
                  {
                    transform: [{
                      rotate: syncSpin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }),
                    }],
                  },
                ]}
              >
                ↻
              </Animated.Text>
            )}
            {pendingCount > 0 && (
              <View style={styles.syncBadge}>
                <Text style={styles.syncBadgeText}>{pendingCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.syncLabel}>{formatLastSynced(lastSynced)}</Text>
        </View>
      </View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.backdrop,
          {
            opacity: backdropOpacity,
          },
        ]}
      />

      <Animated.View
        style={[
          styles.sheet,
          {
            top: collapsedTop,
            width: SHEET_WIDTH,
            height: SHEET_HEIGHT,
            transform: [{ translateY }, { scale: sheetLift }],
          },
        ]}
      >
        <View style={styles.dragHeader} {...panResponder.panHandlers}>
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>

          {isExpanded ? (
            <Animated.View
              style={[
                styles.preloadTextWrap,
                {
                  opacity: preloadOpacity,
                  transform: [{ translateY: preloadSlideY }],
                },
              ]}
            >
              <Pressable
                onPress={() => router.push("/projects/index" as any)}
                style={styles.dashboardPressable}
              >
                <Animated.Text
                  style={[
                    styles.sheetHeadline,
                    {
                      opacity: titleOpacity,
                      transform: [
                        { translateY: titleTranslateY },
                        { scale: titleScale },
                      ],
                    },
                  ]}
                >
                  Project Dashboard
                </Animated.Text>
              </Pressable>
              <Animated.Text style={[styles.sheetSub, { opacity: subOpacity }]}>
                Track active tasks, field updates, and priorities
              </Animated.Text>
            </Animated.View>
          ) : (
            <Animated.View
              style={[styles.collapsedHintRow, { opacity: swipeHintOpacity }]}
            >
              <Text style={styles.collapsedArrow}>↑</Text>
              <View>
                <Text style={styles.collapsedTitle}>Projects Ready</Text>
                <Text style={styles.collapsedSub}>
                  Swipe up to select project
                </Text>
              </View>
            </Animated.View>
          )}
        </View>

        <Animated.View
          style={[
            styles.cardsWrap,
            {
              opacity: cardsOpacity,
              transform: [
                {
                  translateY: cardsOpacity.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
            },
          ]}
          pointerEvents={isExpanded ? "auto" : "none"}
        >
          <FlatList
            data={projects}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => <ProjectCard item={item} />}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
            contentContainerStyle={styles.listContent}
            style={styles.list}
          />
        </Animated.View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },

  webviewWrap: {
    flex: 1,
  },

  syncWrapper: {
    position: "absolute",
    top: 30,
    right: 20,
    alignItems: "center",
    zIndex: 10,
  },

  syncBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(10,92,59,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  syncIcon: {
    fontSize: 22,
    color: "#0A5C3B",
    lineHeight: 24,
  },

  syncBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },

  syncBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#ffffff",
  },

  syncLabel: {
    marginTop: 4,
    fontSize: 9,
    fontWeight: "600",
    color: "#0A5C3B",
    opacity: 0.7,
  },

  webview: {
    flex: 1,
    backgroundColor: "#ffffff",
  },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },

  sheet: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 32,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 24,
    overflow: "hidden",
    zIndex: 30,
    borderWidth: 1.2,
    borderColor: "#E3EEE8",
  },

  dragHeader: {
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    overflow: "visible",
    zIndex: 4,
  },

  handleWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    height: 14,
  },

  handle: {
    width: 54,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#D8DCE8",
  },

  preloadTextWrap: {
    alignItems: "center",
  },

  dashboardPressable: {
    alignSelf: "center",
  },

  sheetHeadline: {
    fontSize: 22,
    fontWeight: "800",
    color: PRIMARY,
    textAlign: "center",
    letterSpacing: -0.4,
  },

  sheetSub: {
    marginTop: 6,
    fontSize: 12,
    color: "#537365",
    textAlign: "center",
    fontWeight: "600",
  },

  swipeHintWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: PRIMARY_SOFT,
    borderWidth: 1,
    borderColor: "rgba(10,92,59,0.08)",
  },

  swipeHintText: {
    fontSize: 11,
    fontWeight: "800",
    color: PRIMARY,
    letterSpacing: 0.2,
  },

  swipeHintArrow: {
    fontSize: 14,
    fontWeight: "900",
    color: PRIMARY,
    marginTop: -1,
  },

  cardsWrap: {
    flex: 1,
    minHeight: 0,
    paddingBottom: 14,
    backgroundColor: "#F8FCFA",
  },

  list: {
    flex: 1,
  },

  listContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 20,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 7,
    borderWidth: 1,
  },

  cardHero: {
    marginHorizontal: 14,
    marginTop: 14,
    height: 148,
    borderRadius: 20,
    overflow: "hidden",
    position: "relative",
  },

  cardTopHighlight: {
    position: "absolute",
    top: 0,
    left: 18,
    right: 18,
    height: 2,
    borderBottomLeftRadius: 999,
    borderBottomRightRadius: 999,
    zIndex: 10,
  },

  cardHeroGradientBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#F8FCFA",
  },

  cardHeroOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.06,
  },

  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    flexWrap: "wrap",
    opacity: 0.04,
  },

  gridSquare: {
    width: "10%",
    height: "20%",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.45)",
  },

  glowOrbLeft: {
    position: "absolute",
    width: 0,
    height: 0,
    opacity: 0,
  },

  glowOrbRight: {
    position: "absolute",
    width: 0,
    height: 0,
    opacity: 0,
  },

  cardHeroFullBgLogo: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
    opacity: 1,
  },

  cardHeroWatermark: {
    position: "absolute",
    right: 18,
    bottom: 6,
    fontSize: 72,
    opacity: 0.16,
  },

  cardHeroContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: "space-between",
  },

  heroBadgeRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },

  heroStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },

  heroStatusText: {
    fontSize: 11,
    fontWeight: "800",
  },

  heroLogoWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  cardHeroIcon: {
    fontSize: 46,
  },

  cardHeroLogo: {
    width: 88,
    height: 88,
  },

  cardBody: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 16,
    alignItems: "center",
  },

  cardTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: PRIMARY,
    lineHeight: 28,
    textAlign: "center",
    letterSpacing: 0.4,
  },

  cardDesc: {
    fontSize: 14,
    lineHeight: 20,
    color: "#537365",
    marginTop: 6,
    textAlign: "center",
    fontWeight: "700",
  },

  cardDivider: {
    height: 1,
    width: "100%",
    marginTop: 14,
    marginBottom: 14,
    opacity: 0.9,
  },

  metaRow: {
    width: "100%",
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },

  infoPill: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "#F7FBF9",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#E1ECE6",
    alignItems: "center",
    justifyContent: "center",
  },

  infoPillLabel: {
    fontSize: 11,
    color: "#537365",
    marginBottom: 4,
    fontWeight: "700",
    textAlign: "center",
  },

  infoPillValue: {
    fontSize: 13,
    color: PRIMARY,
    fontWeight: "800",
    textAlign: "center",
  },

  cardButton: {
    height: 50,
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    position: "relative",
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },

  cardButtonBg: {
    ...StyleSheet.absoluteFillObject,
  },

  cardButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },

  swipeArrowStack: {
    alignItems: "center",
    justifyContent: "center",
    height: 18,
  },

  swipeHintArrowGhost: {
    fontSize: 12,
    fontWeight: "900",
    color: PRIMARY,
    opacity: 0.35,
    marginTop: -8,
  },

  cardButtonArrow: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
    marginTop: -1,
  },

  collapsedHintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 4,
  },

  collapsedArrow: {
    fontSize: 30,
    fontWeight: "900",
    color: PRIMARY,
    marginTop: -2,
  },

  collapsedTitle: {
    fontSize: 21,
    fontWeight: "700",
    color: PRIMARY,
    letterSpacing: 0.1,
  },

  collapsedSub: {
    fontSize: 15,
    color: "#6b7280",
    marginTop: 1,
  },
});
