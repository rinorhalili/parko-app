import { request, type MobileParking } from "../api";

type Listener = () => void;
let parkings: MobileParking[] = [];
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) listener();
}

export const parkingStore = {
  getSnapshot: () => parkings,
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  async refresh() {
    parkings = await request<MobileParking[]>("/parking?page=0");
    notify();
  },
  updateStatus(parkingSpotId: string, status: string) {
    parkings = parkings.map((item) => (item.id === parkingSpotId ? { ...item, status } : item));
    notify();
  },
};
