import type { PassengerDistrictKind } from './passengerDemand.js';

export type StationKind = PassengerDistrictKind;

export type Passenger = {
  id: number;
  origin: string;
  destination: string;
  route: string[];
};

export type Station = {
  id: string;
  name: string;
  x: number;
  y: number;
  kind: StationKind;
  queue: Passenger[];
  overload: number;
};

export type Train = {
  id: number;
  lastStationId: string;
  stationIndex: number;
  direction: 1 | -1;
  progress: number;
  dwell: number;
  passengers: Passenger[];
};

export type MetroLine = {
  id: number;
  name: string;
  color: string;
  stations: string[];
  trains: Train[];
  fleetSize: number;
};
