#version 300 es

precision highp float;
precision highp int;

out vec4 FragColor;
in vec3 fragPos;  
in vec3 normal;  
in vec2 texCoord;

struct Material {
    sampler2D diffuse; 
    vec3 specular;     
    float shininess;   
};

struct Light {
    vec3 direction;
    vec3 ambient; 
    vec3 diffuse; 
    vec3 specular; 
};

uniform Material material;
uniform Light light;
uniform vec3 u_viewPos;
uniform int u_toonLevels; 

// 수정된 양자화(Quantization) 함수
float quantize(float val, int levels) {
    // 1레벨일 때는 단일 색상(Flat)으로 보이도록 처리 및 0으로 나누기 방지
    if (levels <= 1) return 0.0; 
    
    float fLevels = float(levels);
    float scaled = val * fLevels;
    float bin = floor(scaled);
    
    // 값이 1.0일 때 배열 인덱스를 초과하지 않도록 안전장치
    if (bin >= fLevels) {
        bin = fLevels - 1.0;
    }   
    
    // 완벽한 0.0 ~ 1.0 사이의 계단값을 반환하도록 (fLevels - 1.0)으로 나눔
    return bin / (fLevels - 1.0);
}

void main() {
    // 1. Ambient
    vec3 rgb = texture(material.diffuse, texCoord).rgb;
    vec3 ambient = light.ambient * rgb;
  	
    // 2. Diffuse 
    vec3 norm = normalize(normal);
    vec3 lightDir = normalize(light.direction);
    float dotNormLight = dot(norm, lightDir);
    
    float diff = max(dotNormLight, 0.0);
    diff = quantize(diff, u_toonLevels); 
    
    vec3 diffuse = light.diffuse * diff * rgb;  
    
    // 3. Specular
    vec3 viewDir = normalize(u_viewPos - fragPos);
    vec3 reflectDir = reflect(-lightDir, norm);
    float spec = 0.0;
    if (dotNormLight > 0.0) {
        spec = pow(max(dot(viewDir, reflectDir), 0.0), material.shininess);
        spec = quantize(spec, u_toonLevels);
    }
    vec3 specular = light.specular * spec * material.specular;  
        
    vec3 result = ambient + diffuse + specular;
    FragColor = vec4(result, 1.0);
}