import type { AppDataset } from "../types";

export async function loadDataset(): Promise<AppDataset> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/series.json`);
  if (!response.ok) {
    throw new Error(`Unable to load data: ${response.status}`);
  }
  return response.json();
}
