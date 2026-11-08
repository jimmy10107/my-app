const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function linkedPlantingId(search) {
  const id = new URLSearchParams(search).get('plant');
  return id && UUID_RE.test(id) ? id : null;
}

export function wallPathForPlanting(id) {
  return typeof id === 'string' && UUID_RE.test(id) ? `/wall?${new URLSearchParams({ plant: id })}` : '/wall';
}
