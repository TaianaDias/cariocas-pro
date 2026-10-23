import { strict as assert } from "node:assert";
import { test } from "node:test";
import { firebaseEmulators } from "../../src/lib/firebase-emulators";

const settings = { enabled: true, environment: "development", projectId: "demo-cariocas-pro", authHost: "127.0.0.1:9095", firestoreHost: "127.0.0.1:8085" };
test("emulação somente em projeto demo e hosts locais de desenvolvimento/teste", () => {
  assert.deepEqual(firebaseEmulators(settings), { auth: { host: "127.0.0.1", port: 9095 }, firestore: { host: "127.0.0.1", port: 8085 } });
  assert.equal(firebaseEmulators({ ...settings, enabled: false }), null);
  for (const invalid of [
    { ...settings, environment: "production" }, { ...settings, projectId: "projeto-real" },
    { ...settings, authHost: "firebase.exemplo.com:9095" }, { ...settings, firestoreHost: "127.0.0.1:99999" },
    { ...settings, authHost: undefined },
  ]) assert.throws(() => firebaseEmulators(invalid));
});
