// Internal pin paths of a piece. Each link joins an input terminal to an output
// terminal. The solver bridges those two pins while the piece is conducting.

export function defaultPinLinks(pins) {
  const links = [];
  const list = pins || [];
  for (let index = 0; index < list.length - 1; index += 2) {
    links.push({
      id: `link_${list[index].id}_${list[index + 1].id}`,
      from: list[index].id,
      to: list[index + 1].id
    });
  }
  return links;
}

export function livePinLinks(pins, pinLinks) {
  const ids = new Set((pins || []).map(pin => pin.id));
  return (pinLinks || []).filter(link => link && ids.has(link.from) && ids.has(link.to));
}

export function conductingPairs(def) {
  const pins = def?.pins || [];
  const links = Array.isArray(def?.pinLinks) ? livePinLinks(pins, def.pinLinks) : defaultPinLinks(pins);
  return links
    .filter(link => link.from !== link.to)
    .map(link => [link.from, link.to]);
}
