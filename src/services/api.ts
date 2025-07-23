import axios from "axios";
import { Artwork } from "../types/artwork";

export const getArtworksByPage = async (page: number): Promise<{ data: Artwork[]; total: number }> => {
  const res = await axios.get(`https://api.artic.edu/api/v1/artworks?page=${page}`);
  return {
    data: res.data.data,
    total: res.data.pagination.total,
  };
};
