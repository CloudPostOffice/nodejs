// ESM wrapper — re-exports everything from the CJS entry point
import cpo from './index.js';

export const { device, publish, subscribe, configure } = cpo;
export default cpo;
