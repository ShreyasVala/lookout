import L from 'leaflet';

export function pinIcon(status = 'missing') {
  return L.divIcon({
    className: '',
    html: `<div class="pin ${status}"></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -28],
  });
}
