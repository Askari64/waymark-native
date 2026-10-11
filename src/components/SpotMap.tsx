import React from "react";
import {
  Map,
  Camera,
  GeoJSONSource,
  Layer,
} from "@maplibre/maplibre-react-native";
import type { Point } from "../lib/geo";
export type MapProps = {
  point: Point;
  target?: Point;
  route?: number[][];
  // Other route options, drawn muted underneath the selected route.
  others?: number[][][];
  dark?: boolean;
};
export default function SpotMap({
  point,
  target,
  route,
  others,
  dark,
}: MapProps) {
  const dots: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: [point, ...(target ? [target] : [])].map((p, i) => ({
      type: "Feature",
      properties: { target: i },
      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
    })),
  };
  return (
    <Map
      style={{ flex: 1 }}
      mapStyle={`https://tiles.openfreemap.org/styles/${dark ? "dark" : "liberty"}`}
      attribution={true}
      logo={false}
      compass={false}
    >
      <Camera
        initialViewState={
          target
            ? {
                bounds: [
                  Math.min(point.lng, target.lng) - 0.001,
                  Math.min(point.lat, target.lat) - 0.001,
                  Math.max(point.lng, target.lng) + 0.001,
                  Math.max(point.lat, target.lat) + 0.001,
                ],
              }
            : { center: [point.lng, point.lat], zoom: 16 }
        }
      />
      {others && others.length > 0 && (
        <GeoJSONSource
          id="route-others"
          data={{
            type: "FeatureCollection",
            features: others.map((coordinates) => ({
              type: "Feature",
              properties: {},
              geometry: { type: "LineString", coordinates },
            })),
          }}
        >
          <Layer
            id="route-others-line"
            type="line"
            paint={{
              "line-color": dark ? "#7C8F84" : "#8A9A90",
              "line-width": 4,
              "line-opacity": 0.7,
            }}
            layout={{ "line-cap": "round", "line-join": "round" }}
          />
        </GeoJSONSource>
      )}
      {route && route.length > 1 && (
        <GeoJSONSource
          id="route"
          data={{
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: route },
          }}
        >
          <Layer
            id="route-line"
            type="line"
            paint={{
              "line-color": "#14856B",
              "line-width": 5,
              "line-opacity": 0.8,
            }}
            layout={{ "line-cap": "round", "line-join": "round" }}
          />
        </GeoJSONSource>
      )}
      <GeoJSONSource id="points" data={dots}>
        <Layer
          id="points-halo"
          type="circle"
          paint={{
            "circle-radius": 16,
            "circle-color": "#FFFFFF",
            "circle-opacity": 0.9,
          }}
        />
        <Layer
          id="points-dot"
          type="circle"
          paint={{
            "circle-radius": 8,
            "circle-color": [
              "match",
              ["get", "target"],
              1,
              "#14856B",
              "#438CDC",
            ],
            "circle-stroke-width": 3,
            "circle-stroke-color": "#FFFFFF",
          }}
        />
      </GeoJSONSource>
    </Map>
  );
}
