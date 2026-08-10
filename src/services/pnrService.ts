import api from "./api";
import type { PnrResponse } from "../types/Pnr";

const pnrService = {
  checkPnr(pnrNumber: string) {
    return api.get<PnrResponse>(`/pnr/${pnrNumber}`);
  },
};

export default pnrService;
