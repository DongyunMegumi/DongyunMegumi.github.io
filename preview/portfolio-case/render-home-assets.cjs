const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require(
  require.resolve("playwright", {
    paths: [
      path.join(
        process.env.USERPROFILE,
        ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules",
      ),
    ],
  }),
);

(async () => {
  const browser = await chromium.launch({
    args: ["--enable-unsafe-swiftshader"],
  });
  try {
    const page = await browser.newPage();
    await page.goto("http://127.0.0.1:4002/models/sumi/");
    const renders = await page.evaluate(async () => {
      const THREE = await import("three");
      const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
      const { VRMLoaderPlugin, VRMUtils } = await import("@pixiv/three-vrm");
      const loader = new GLTFLoader();
      loader.register((parser) => new VRMLoaderPlugin(parser));
      const gltf = await loader.loadAsync("/asset/model.vrm");
      const vrm = gltf.userData.vrm;
      VRMUtils.rotateVRM0(vrm);
      vrm.humanoid.setNormalizedPose({
        leftUpperArm: {
          rotation: new THREE.Quaternion()
            .setFromAxisAngle(new THREE.Vector3(0, 0, 1), 1.02)
            .toArray(),
        },
        rightUpperArm: {
          rotation: new THREE.Quaternion()
            .setFromAxisAngle(new THREE.Vector3(0, 0, 1), -1.02)
            .toArray(),
        },
      });
      vrm.humanoid.update();
      vrm.scene.updateMatrixWorld(true);
      const matcap = await new THREE.TextureLoader().loadAsync(
        "/asset/matcap.png",
      );
      matcap.colorSpace = THREE.SRGBColorSpace;
      const records = [];
      vrm.scene.traverse((mesh) => {
        if (!mesh.isMesh) return;
        mesh.frustumCulled = false;
        const make = (original) => {
          const common = {
            map: original.map,
            side: original.side,
            transparent: original.transparent,
            opacity: original.opacity,
            alphaTest: original.alphaTest,
            depthWrite: original.depthWrite,
          };
          const base = new THREE.MeshBasicMaterial({
            ...common,
            color: 0xffffff,
          });
          const clay = new THREE.MeshMatcapMaterial({
            ...common,
            matcap,
            color: 0xffffff,
          });
          clay.onBeforeCompile = (shader) => {
            shader.fragmentShader = shader.fragmentShader.replace(
              "#include <map_fragment>",
              "#include <map_fragment>\n diffuseColor.rgb = vec3(1.0);",
            );
          };
          if (original.isOutline) {
            base.visible = false;
            clay.visible = false;
          }
          return { base, clay };
        };
        const original = mesh.material;
        const variants = (Array.isArray(original) ? original : [original]).map(
          make,
        );
        records.push({
          mesh,
          base: Array.isArray(original)
            ? variants.map((v) => v.base)
            : variants[0].base,
          clay: Array.isArray(original)
            ? variants.map((v) => v.clay)
            : variants[0].clay,
        });
      });
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
      });
      renderer.setClearColor(0, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      const scene = new THREE.Scene();
      scene.add(vrm.scene);
      const bounds = new THREE.Box3().setFromObject(vrm.scene);
      const h = bounds.max.y - bounds.min.y;
      const center = bounds.getCenter(new THREE.Vector3());
      const head = new THREE.Vector3();
      vrm.humanoid.getNormalizedBoneNode("head").getWorldPosition(head);
      const result = {};
      for (const shot of [
        {
          name: "sumi-full",
          w: 900,
          h: 1400,
          span: h * 1.04,
          target: center,
          angle: 0.12,
          material: "base",
        },
        {
          name: "sumi-portrait",
          w: 1200,
          h: 1400,
          span: h * 0.74,
          target: head.clone().add(new THREE.Vector3(0, -h * 0.13, 0)),
          angle: -0.18,
          material: "base",
        },
        {
          name: "sumi-clay",
          w: 900,
          h: 1400,
          span: h * 1.04,
          target: center,
          angle: 0.12,
          material: "clay",
        },
      ]) {
        for (const record of records)
          record.mesh.material = record[shot.material];
        renderer.setSize(shot.w, shot.h);
        const aspect = shot.w / shot.h;
        const camera = new THREE.OrthographicCamera(
          (-shot.span * aspect) / 2,
          (shot.span * aspect) / 2,
          shot.span / 2,
          -shot.span / 2,
          0.01,
          100,
        );
        camera.position.set(
          shot.target.x + Math.sin(shot.angle) * h * 3,
          shot.target.y,
          shot.target.z + Math.cos(shot.angle) * h * 3,
        );
        camera.lookAt(shot.target);
        renderer.render(scene, camera);
        result[shot.name] = renderer.domElement.toDataURL("image/png");
      }
      renderer.dispose();
      return result;
    });
    const dest = path.join(__dirname, ".local-assets");
    await fs.mkdir(dest, { recursive: true });
    for (const [name, data] of Object.entries(renders)) {
      await fs.writeFile(
        path.join(dest, name + ".png"),
        Buffer.from(data.split(",")[1], "base64"),
      );
      console.log("Rendered " + name);
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
