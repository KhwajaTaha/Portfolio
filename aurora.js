const B = (typeof BABYLON !== "undefined") ? BABYLON : globalThis.BABYLON;
const NOISE_GLSL = `
float hash(vec2 p){
    p = fract(p * vec2(233.34, 851.73));
    p += dot(p, p + 23.45);
    return fract(p.x * p.y);
}
float vnoise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p){
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++){
        v += a * vnoise(p);
        p = p * 2.03 + vec2(3.17, 1.71);
        a *= 0.5;
    }
    return v;
}
`;
function registerShaders() {
    const S = B.Effect.ShadersStore;
    S["auroraVertexShader"] = `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
uniform mat4 worldViewProjection;
uniform float time;
uniform float seed;
varying vec2 vUV;
void main(void){
    vUV = uv;
    vec3 p = position;
    float sway = sin(p.x * 0.004 + time * 0.30 + seed) * 26.0
               + sin(p.z * 0.006 - time * 0.21 + seed * 2.3) * 18.0;
    float lift = uv.y * uv.y;
    p.x += sway * lift;
    p.z += cos(p.x * 0.003 + time * 0.25 + seed * 1.7) * 22.0 * lift;
    gl_Position = worldViewProjection * vec4(p, 1.0);
}
`;
    S["auroraFragmentShader"] = `
precision highp float;
varying vec2 vUV;
uniform float time;
uniform float seed;
uniform float intensity;
uniform vec3 colLow;
uniform vec3 colMid;
uniform vec3 colHigh;
` + NOISE_GLSL + `
void main(void){
    vec2 uv = vUV;
    float t = time * 0.05 + seed * 9.0;
    float hem = 0.11 * fbm(vec2(uv.x * 3.0 + t * 1.4, seed))
              + 0.05 * sin(uv.x * 17.0 + t * 3.6 + seed * 6.0);
    float h = clamp((uv.y - hem) / (1.0 - hem * 0.5), 0.0, 1.0);
    float rays = fbm(vec2(uv.x * 42.0 + t * 3.0, uv.y * 1.4 - t * 2.0));
    rays = pow(rays, 1.6);
    float fine = fbm(vec2(uv.x * 130.0 - t * 5.0, uv.y * 0.6));
    rays = mix(rays, rays * fine * 2.0, 0.55);
    float density = smoothstep(0.22, 0.82, fbm(vec2(uv.x * 2.1 - t * 0.7, seed * 3.0)));
    float base = smoothstep(0.0, 0.045, h);
    float fade = pow(1.0 - h, 2.3);
    float hotEdge = exp(-h * 34.0) * 0.85;
    float ends = smoothstep(0.0, 0.20, uv.x) * (1.0 - smoothstep(0.80, 1.0, uv.x));
    float a = (fade * rays * 1.45 + hotEdge) * base * density * ends * intensity;
    vec3 col = mix(colLow, colMid, smoothstep(0.0, 0.35, h));
    col = mix(col, colHigh, smoothstep(0.42, 0.95, h));
    col += colLow * hotEdge * 0.7;
    gl_FragColor = vec4(col * a, a);
}
`;
    S["nightVertexShader"] = `
precision highp float;
attribute vec3 position;
uniform mat4 worldViewProjection;
varying vec3 vDir;
void main(void){
    vDir = position;
    gl_Position = worldViewProjection * vec4(position, 1.0);
}
`;
    S["nightFragmentShader"] = `
precision highp float;
varying vec3 vDir;
uniform float time;
` + NOISE_GLSL + `
void main(void){
    vec3 d = normalize(vDir);
    vec2 sph = vec2(atan(d.z, d.x) / 6.28318 + 0.5,
                    asin(clamp(d.y, -1.0, 1.0)) / 3.14159 + 0.5);
    float up = smoothstep(-0.10, 0.75, d.y);
    vec3 col = mix(vec3(0.035, 0.065, 0.125), vec3(0.006, 0.012, 0.038), up);
    float neb = fbm(vec2(sph.x * 9.0, sph.y * 14.0));
    col += vec3(0.05, 0.055, 0.10) * pow(neb, 2.0) * smoothstep(-0.05, 0.6, d.y);
    vec2 g = sph * vec2(1100.0, 550.0);
    vec2 gi = floor(g);
    vec2 gf = fract(g);
    float rnd = hash(gi);
    float on = step(0.955, rnd);
    vec2 c = vec2(hash(gi + 0.31), hash(gi + 0.77));
    float dist = length(gf - c);
    float star = smoothstep(0.40, 0.0, dist);
    star *= on * ((rnd - 0.955) / 0.045);
    star *= 0.55 + 0.45 * sin(time * 1.8 + rnd * 120.0);
    star *= smoothstep(-0.02, 0.18, d.y);
    vec3 starTint = mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.92, 0.80), hash(gi + 4.4));
    col += starTint * star * 1.6;
    gl_FragColor = vec4(col, 1.0);
}
`;
}
export function createScene(engineArg, canvasArg) {
    const engine = engineArg || globalThis.engine;
    const canvas = canvasArg || (engine && engine.getRenderingCanvas
                                 ? engine.getRenderingCanvas()
                                 : globalThis.canvas);
    registerShaders();
    const scene = new B.Scene(engine);
    scene.clearColor = new B.Color4(0, 0, 0, 1);
    scene.fogMode = B.Scene.FOGMODE_EXP2;
    scene.fogColor = new B.Color3(0.035, 0.06, 0.11);
    scene.fogDensity = 0.0011;
    const camera = new B.ArcRotateCamera(
        "cam", -Math.PI / 2, 1.32, 300, new B.Vector3(0, 95, 0), scene);
    if (canvas) camera.attachControl(canvas, true);
    camera.minZ = 0.5;
    camera.maxZ = 20000;
    camera.lowerBetaLimit = 0.55;
    camera.upperBetaLimit = 1.545;
    camera.lowerRadiusLimit = 80;
    camera.upperRadiusLimit = 900;
    camera.wheelPrecision = 0.4;
    camera.fov = 0.95;
    const timeMats = [];
    const sky = B.MeshBuilder.CreateSphere("sky", { diameter: 12000, segments: 48 }, scene);
    const skyMat = new B.ShaderMaterial("skyMat", scene,
        { vertex: "night", fragment: "night" },
        { attributes: ["position"], uniforms: ["worldViewProjection", "time"] });
    skyMat.backFaceCulling = false;
    skyMat.setFloat("time", 0);
    sky.material = skyMat;
    sky.applyFog = false;
    sky.isPickable = false;
    sky.infiniteDistance = false;
    timeMats.push(skyMat);
    function makeCurtain(cfg) {
        const rows = 18, cols = 190, paths = [];
        for (let r = 0; r < rows; r++) {
            const v = r / (rows - 1);
            const y = cfg.baseY + v * cfg.height;
            const path = [];
            for (let c = 0; c < cols; c++) {
                const u = c / (cols - 1);
                const ang = cfg.a0 + u * (cfg.a1 - cfg.a0);
                const rad = cfg.radius
                    + Math.sin(u * Math.PI * 3.0 + cfg.phase) * cfg.wobble
                    + Math.sin(u * Math.PI * 7.0 + cfg.phase * 2.1) * cfg.wobble * 0.45
                    + Math.sin(u * Math.PI * 13.0 + cfg.phase * 3.3) * cfg.wobble * 0.18;
                path.push(new B.Vector3(Math.cos(ang) * rad, y, Math.sin(ang) * rad));
            }
            paths.push(path);
        }
        const mesh = B.MeshBuilder.CreateRibbon(cfg.name, {
            pathArray: paths,
            sideOrientation: B.Mesh.DOUBLESIDE
        }, scene);
        const mat = new B.ShaderMaterial(cfg.name + "Mat", scene,
            { vertex: "aurora", fragment: "aurora" },
            {
                attributes: ["position", "uv"],
                uniforms: ["worldViewProjection", "time", "seed", "intensity",
                           "colLow", "colMid", "colHigh"]
            });
        mat.setFloat("time", 0);
        mat.setFloat("seed", cfg.seed);
        mat.setFloat("intensity", cfg.intensity);
        mat.setColor3("colLow", cfg.colLow);
        mat.setColor3("colMid", cfg.colMid);
        mat.setColor3("colHigh", cfg.colHigh);
        mat.backFaceCulling = false;
        mat.alphaMode = B.Engine.ALPHA_ONEONE;
        mat.needAlphaBlending = () => true;
        mat.disableDepthWrite = true;
        mesh.material = mat;
        mesh.renderingGroupId = 1;
        mesh.applyFog = false;
        mesh.isPickable = false;
        mesh.alwaysSelectAsActiveMesh = true;
        timeMats.push(mat);
        return mesh;
    }
    const GREEN  = new B.Color3(0.10, 1.00, 0.52);
    const TEAL   = new B.Color3(0.16, 0.86, 0.80);
    const VIOLET = new B.Color3(0.62, 0.30, 1.00);
    const ROSE   = new B.Color3(1.00, 0.32, 0.62);
    const ICE    = new B.Color3(0.40, 0.72, 1.00);
    const curtains = [
        makeCurtain({ name: "c1", radius: 900,  a0: -2.85, a1: -0.30, baseY: 150, height: 620,
                      wobble: 150, phase: 0.4, seed: 0.13, intensity: 1.15,
                      colLow: GREEN,  colMid: TEAL,  colHigh: VIOLET }),
        makeCurtain({ name: "c2", radius: 1250, a0: -3.35, a1: -0.55, baseY: 230, height: 780,
                      wobble: 210, phase: 2.1, seed: 0.57, intensity: 0.85,
                      colLow: TEAL,   colMid: GREEN, colHigh: ROSE }),
        makeCurtain({ name: "c3", radius: 640,  a0: -2.45, a1: -0.95, baseY: 120, height: 470,
                      wobble: 95,  phase: 4.2, seed: 0.81, intensity: 0.95,
                      colLow: GREEN,  colMid: ICE,   colHigh: VIOLET }),
        makeCurtain({ name: "c4", radius: 1650, a0: -3.60, a1: -1.90, baseY: 320, height: 900,
                      wobble: 280, phase: 5.5, seed: 0.34, intensity: 0.55,
                      colLow: VIOLET, colMid: ROSE,  colHigh: ICE })
    ];
    function mountainRing(name, radius, base, scale, off, shade) {
        const n = 480, bottom = [], top = [];
        for (let i = 0; i <= n; i++) {
            const a = (i / n) * Math.PI * 2.0;
            let h = (Math.sin(a * 3.0 + off) * 0.5 + 0.5)
                  + (Math.sin(a * 7.0 + off * 2.3) * 0.5 + 0.5) * 0.60
                  + (Math.sin(a * 13.0 + off * 4.1) * 0.5 + 0.5) * 0.30
                  + (Math.sin(a * 23.0 + off * 1.7) * 0.5 + 0.5) * 0.14;
            h = Math.pow(h / 2.04, 1.8) * scale + base;
            const cx = Math.cos(a), cz = Math.sin(a);
            bottom.push(new B.Vector3(cx * radius, -60, cz * radius));
            top.push(new B.Vector3(cx * radius, h, cz * radius));
        }
        const m = B.MeshBuilder.CreateRibbon(name, {
            pathArray: [bottom, top],
            sideOrientation: B.Mesh.DOUBLESIDE
        }, scene);
        const mat = new B.StandardMaterial(name + "Mat", scene);
        mat.disableLighting = true;
        mat.emissiveColor = shade;
        mat.diffuseColor = B.Color3.Black();
        mat.specularColor = B.Color3.Black();
        m.material = mat;
        m.isPickable = false;
        return m;
    }
    const ridgeFar  = mountainRing("ridgeFar",  2100, 30, 300, 1.3, new B.Color3(0.030, 0.048, 0.085));
    const ridgeMid  = mountainRing("ridgeMid",  1350, 20, 210, 3.7, new B.Color3(0.016, 0.026, 0.050));
    const ridgeNear = mountainRing("ridgeNear",  780, 10, 120, 6.1, new B.Color3(0.005, 0.009, 0.020));
    const water = B.MeshBuilder.CreateGround("water", { width: 9000, height: 9000 }, scene);
    water.position.y = 0;
    water.isPickable = false;
    const mirror = new B.MirrorTexture("mirror", { ratio: 0.85 }, scene, true);
    mirror.mirrorPlane = new B.Plane(0, -1, 0, 0);
    mirror.renderList = [sky, ridgeFar, ridgeMid, ridgeNear].concat(curtains);
    mirror.level = 1.0;
    mirror.adaptiveBlurKernel = 18;
    const waterMat = new B.StandardMaterial("waterMat", scene);
    waterMat.disableLighting = true;
    waterMat.diffuseColor = new B.Color3(0.004, 0.008, 0.016);
    waterMat.emissiveColor = new B.Color3(0.004, 0.008, 0.016);
    waterMat.specularColor = B.Color3.Black();
    waterMat.reflectionTexture = mirror;
    waterMat.reflectionFresnelParameters = new B.FresnelParameters();
    waterMat.reflectionFresnelParameters.bias = 0.12;
    waterMat.reflectionFresnelParameters.power = 1.6;
    water.material = waterMat;
    const pipe = new B.DefaultRenderingPipeline("post", true, scene, [camera]);
    pipe.fxaaEnabled = true;
    pipe.bloomEnabled = true;
    pipe.bloomThreshold = 0.06;
    pipe.bloomWeight = 0.95;
    pipe.bloomKernel = 96;
    pipe.bloomScale = 0.55;
    pipe.imageProcessingEnabled = true;
    pipe.imageProcessing.toneMappingEnabled = true;
    pipe.imageProcessing.toneMappingType = B.ImageProcessingConfiguration.TONEMAPPING_ACES;
    pipe.imageProcessing.exposure = 1.45;
    pipe.imageProcessing.contrast = 1.35;
    pipe.imageProcessing.vignetteEnabled = true;
    pipe.imageProcessing.vignetteWeight = 3.2;
    pipe.imageProcessing.vignetteColor = new B.Color4(0, 0, 0, 0);
    pipe.grainEnabled = true;
    pipe.grain.intensity = 7;
    pipe.grain.animated = true;
    let t = 0;
    scene.registerBeforeRender(() => {
        const dt = engine.getDeltaTime() * 0.001;
        t += dt;
        for (let i = 0; i < timeMats.length; i++) timeMats[i].setFloat("time", t);
        camera.alpha += dt * 0.012;
        sky.position.x = camera.position.x;
        sky.position.z = camera.position.z;
        sky.position.y = 0;
    });
    return scene;
}
export default createScene;
export class Playground {
    static CreateScene(engine, canvas) {
        return createScene(engine, canvas);
    }
}
