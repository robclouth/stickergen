//PARAMS
let xVariation = 50;
let yVariation = 100;
let widthVariation = 100;
let xStep = 50;
let noisinessX = 1;
let animationSpeed = 0.001;


let yoff = 0.0;

function setup() {
  createCanvas(windowWidth, 400);
}

function draw() {
  background(255);

  stroke(0);
  noFill();
  beginShape(TRIANGLE_STRIP);

  let xoff = 0;
  let prevX = 0;
    
  for (let x = -xVariation; x <= width + xVariation; x += xStep) {
    let spacing = map(noise(xoff+100, yoff+100), 0, 1, 5, widthVariation);
    
    let y = map(noise(xoff, yoff), 0, 1, height/2 - yVariation, height/2 + yVariation);
    
    let x1Offset = map(noise(xoff+1000, yoff+1000), 0, 1, -xVariation, xVariation);
    let x2Offset = map(noise(xoff+2000, yoff+2000), 0, 1, -xVariation, xVariation);

    vertex(x + x1Offset, y + spacing / 2);
    vertex(x + x2Offset, y - spacing / 2);
    
    xoff += noisinessX;
  }

  yoff += animationSpeed;

  endShape();
}

