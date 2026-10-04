import * as THREE from 'three';

// Keep native Three lighting, shadow maps and fog for both soil and vegetation.
export function grassMaterial(time: { value: number }, fieldDriven = false) {
  const material = new THREE.MeshStandardMaterial({
    roughness: 1,
    side: THREE.DoubleSide,
  });
  material.userData.grassTime = time;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.grassTime = time;
    shader.vertexShader = `uniform float grassTime;
      attribute vec3 groundNormal; attribute vec3 groundColor;
      ${fieldDriven ? 'attribute vec2 windBend; attribute vec2 contactBend;' : ''}
      varying vec3 vGrassNormal; varying vec3 vGroundColor;
      varying float vBladeHeight; varying float vGrassDistance; varying float vGrassAccent;
      ${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      vec3 root = (instanceMatrix * vec4(0.,0.,0.,1.)).xyz;
      float variation = fract(sin(dot(root.xz,vec2(12.9898,78.233)))*43758.5453);
      ${
        fieldDriven
          ? ''
          : `float gust = sin(grassTime*.8 + root.x*.075 + root.z*.045);
      transformed.x += (.18 + variation*.48 + gust*.17)*position.y*position.y;
      transformed.z += cos(grassTime*.6+root.z*.065)*.08*position.y*position.y;`
      }
      vGrassNormal = normalize(normalMatrix * groundNormal);
      vGroundColor = groundColor;
      vBladeHeight = position.y;
      vGrassAccent = smoothstep(.55,.95,variation);
      vGrassDistance = distance(cameraPosition, (modelMatrix * vec4(root,1.)).xyz);
    `
    );
    if (fieldDriven)
      shader.vertexShader = shader.vertexShader.replace(
        '#include <project_vertex>',
        `
      vec4 mvPosition = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        mvPosition = instanceMatrix * mvPosition;
      #endif
      // Displace in world-aligned mesh space AFTER per-blade yaw/scale.
      float flutter = 1. + .10*sin(grassTime*2.1 + root.x*1.7 + root.z*2.3);
      vec2 combinedBend = windBend * flutter + contactBend;
      float bladeLength = length(instanceMatrix[1].xyz);
      float bendLength = length(combinedBend);
      float bendLimit = bladeLength*.85;
      combinedBend *= min(1.,bendLimit/max(bendLength,.00001));
      float ratio = min(.85,bendLength/max(bladeLength,.00001));
      mvPosition.xz += combinedBend * position.y * position.y;
      mvPosition.y -= bladeLength*(1.-sqrt(1.-ratio*ratio))*position.y*position.y;
      mvPosition = modelViewMatrix * mvPosition;
      gl_Position = projectionMatrix * mvPosition;
    `
      );
    shader.fragmentShader = `varying vec3 vGrassNormal; varying vec3 vGroundColor;
      varying float vBladeHeight; varying float vGrassDistance; varying float vGrassAccent;
      ${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `
      #include <color_fragment>
      // Retain mid-distance silhouettes; only the far meadow merges into the soil.
      float detail = mix(.25,1.,1.-smoothstep(80.,240.,vGrassDistance));
      float tip = smoothstep(.25,.95,vBladeHeight);
      // Selected leaf tips catch a warm yellow-green accent, still shaded by the
      // native lighting below. Never use emissive color to brighten shaded grass.
      vec3 leaf = mix(diffuseColor.rgb,vec3(.68,.78,.32),tip*(.16+.58*vGrassAccent));
      diffuseColor.rgb = mix(vGroundColor,leaf,detail*mix(.12,.92,smoothstep(0.,.8,vBladeHeight)));
      diffuseColor.rgb *= mix(.94,1.04,tip);
    `
    );
    // A meadow behaves as a softly lit canopy. Do not flip every thin leaf dark
    // when the camera sees its back; use the ground slope for stable shared light.
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_begin>',
      `
      #include <normal_fragment_begin>
      normal = normalize(vGrassNormal);
    `
    );
  };
  material.customProgramCacheKey = () =>
    fieldDriven ? 'sheem-grass-field-contact-v2' : 'sheem-grass-lit-v2';
  return material;
}

export function meadowGroundMaterial() {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = `varying vec3 vMeadowWorld;
${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      vMeadowWorld = (modelMatrix * vec4(position,1.)).xyz;
    `
    );
    shader.fragmentShader = `varying vec3 vMeadowWorld;
      float meadowHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float meadowNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(meadowHash(i),meadowHash(i+vec2(1,0)),f.x),mix(meadowHash(i+vec2(0,1)),meadowHash(i+1.),f.x),f.y);}
      ${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `
      #include <color_fragment>
      float nearDetail = 1.-smoothstep(30.,130.,distance(cameraPosition,vMeadowWorld));
      float flecks = meadowNoise(vMeadowWorld.xz*5.);
      float patches = meadowNoise(vMeadowWorld.xz*.7);
      diffuseColor.rgb *= 1. + ((flecks-.5)*.2+(patches-.5)*.12)*nearDetail;
    `
    );
  };
  material.customProgramCacheKey = () => 'sheem-ground-cover-v1';
  return material;
}
