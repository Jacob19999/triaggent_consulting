"use client";
import { useData } from "./DataProvider";

export function useMyShelf() {
  const { session, data, outlooks } = useData();
  const shelf = data.shelves.find((s) => s.id === session.shelfId) ?? null;
  const outlook = outlooks.find((o) => o.shelf.id === shelf?.id) ?? null;
  return { shelf, outlook };
}
