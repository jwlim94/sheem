export const planetVertex = `varying vec3 vNormal;varying vec3 vPosition;varying vec3 vWorld;
void main(){vNormal=normalize(mat3(modelMatrix)*normal);vPosition=position;vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
export const planetFragment = `uniform vec3 uColor;uniform float uSeed;varying vec3 vNormal;varying vec3 vPosition;varying vec3 vWorld;
float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise3(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=noise3(p)*a;p=p*2.02+vec3(4.1,9.3,2.4);a*=.5;}return s;}
void main(){vec3 p=vPosition*1.7+uSeed;float field=fbm(p);float detail=fbm(p*3.+field);vec3 N=normalize(vNormal),V=normalize(cameraPosition-vWorld);float light=max(dot(N,normalize(vec3(-.5,.8,1.))),0.);float rim=pow(1.-max(dot(N,V),0.),3.);vec3 surface=mix(uColor*.28,uColor*1.1,smoothstep(.2,.8,field*.5+detail*.5));vec3 c=surface*(.12+light*1.2)+uColor*rim*.36;gl_FragColor=vec4(c,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
