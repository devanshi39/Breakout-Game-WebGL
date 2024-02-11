var canvas = document.getElementById('game');
var gl = canvas.getContext('experimental-webgl');

//Vertex shader
var vertCode = 'attribute vec3 coordinates;'+
'attribute vec3 color;'+
'varying vec3 vColor;'+
'void main(void) {' +
   ' gl_Position = vec4(coordinates, 1.0);' +
   'vColor = color;'+
'}';
var vertShader = gl.createShader(gl.VERTEX_SHADER);
gl.shaderSource(vertShader, vertCode);
gl.compileShader(vertShader);

//Fragment shader
var fragCode = 'precision mediump float;'+
'varying vec3 vColor;'+
'void main(void) {'+
   'gl_FragColor = vec4(vColor, 1.0);'+
'}';
var fragShader = gl.createShader(gl.FRAGMENT_SHADER);
gl.shaderSource(fragShader, fragCode);
gl.compileShader(fragShader);

//Shader program
var shaderProgram = gl.createProgram();
gl.attachShader(shaderProgram, vertShader);
gl.attachShader(shaderProgram, fragShader);

gl.linkProgram(shaderProgram);
gl.useProgram(shaderProgram);

function reset_paddle() {
    return {
        vertices : [-0.3,-0.8,0.0, -0.3,-0.85,0.0, 0.3,-0.85,0.0, 0.3,-0.8,0.0,], 
        colors : [0.2,0.3,0.8, 0.2,0.5,0.8, 0.2,0.5,0.2, 0.5,0.3,0.8,], 
        indices : [0,1,2,0,2,3],
        speed : 0.03,
        width : 0.6
    };
}

function reset_ball() {
    var v = [0,-0.765,0,];
    var c = [0.8,0,0];
    var ind = [];
    var sides = 50;
    var radius = 0.03;
    for(let i=1;i<=sides;i++) {
        v.push(v[0] + radius*Math.cos(2*Math.PI*i/sides), v[1] + radius*Math.sin(2*Math.PI*i/sides), 0.0);
        c.push(0.8,0,0);
        if(i!=sides) {
            ind.push(0,i,i+1);
        } else {
            ind.push(0,i,1);
        }
    }
    var speed = 0.025;
    var random_number = Math.random();
    if(random_number<0.1) {
        random_number += 0.2;
    }
    if(random_number>0.9) {
        random_number -= 0.2;
    }
    if(random_number>0.5) {
        random_number = random_number - 1;
    }
    random_number *= 1.5;
    random_number = Math.round(random_number*100)/100;
    var direction = {x : random_number, y : 1-Math.abs(random_number)}; 
    return {sides : sides, vertices : v, colors : c, indices : ind, speed : speed, direction : direction, radius : radius};
}

function reset_bricks() {
    var bricks = [];
    var rows = 5;
    var columns = 8;
    var width = 2/columns;
    var height = 0.15;
    var colors = [
        {red : 0.58, green : 0, blue : 0.83},
        {red : 0.29, green : 0, blue : 0.51},
        {red : 0, green : 0, blue : 1},
        {red : 0, green : 1, blue : 0},
        {red : 1, green : 1, blue : 0},
        {red : 1, green : 0.5, blue : 0},
        {red : 1, green : 0, blue : 0},
    ];
    var gap = 0.0125;
    var ci = Math.floor(Math.random() * (6 + 1));
    for(let i = 0; i < rows; i++) {
        var c = (ci+i)%7;
        for(let j = 0; j < columns; j++) {
            var color = [];
            for(let i=0;i<4;i++) {
                color.push(colors[c].red, colors[c].green, colors[c].blue,);
            }
            var zero_index = {x : -1+j*width, y : 1-i*height};
            var v = [
                zero_index.x+gap,zero_index.y-gap,0.0,
                zero_index.x + width-gap,zero_index.y-gap,0.0,
                zero_index.x+gap,zero_index.y - height+gap,0.0,
                zero_index.x + width-gap,zero_index.y - height+gap,0.0,
            ];
            bricks.push({
                vertices : v,
                colors : color,
                indices : [0,1,2,1,2,3],
                visible : true,
                score : (rows-i)
            });
        }
    }
    return bricks;
}

function restart_game() {
    if(animationId!=0)
        window.cancelAnimationFrame(animationId);
    paddle = reset_paddle();
    ball = reset_ball();
    bricks = reset_bricks();
    score = 0;
    level = 1;
    lives = 3;
    game_started = false;
    document.getElementById("score").innerHTML = "Score : "+score;
    document.getElementById("level").innerHTML = "Level : "+level;
    document.getElementById("lives").innerHTML = "Lives : "+lives;
    game_not_start();
}

// Objects
var paddle, ball, bricks, score, level, lives, game_started;
var animationId=0;

function mergeTriangles(obj1, obj2, obj3) {
    var temp_indices = obj1.indices.concat(obj2.indices.map((value, index, array) => {return value + obj1.vertices.length/3}));
    var triangles = {
        vertices : obj1.vertices.concat(obj2.vertices), 
        colors : obj1.colors.concat(obj2.colors), 
        indices : temp_indices
    };
    obj3.forEach((value, index, array) => {
        if(value.visible) {
            triangles = {
                vertices : triangles.vertices.concat(value.vertices),
                colors : triangles.colors.concat(value.colors),
                indices : triangles.indices.concat(value.indices.map((v,ind,a) => {return v + triangles.vertices.length/3}))
            }; 
        }
    });
    return triangles;
}

function mergePlayButton(obj1) {
    return {
        vertices : obj1.vertices.concat([0.15,0.0,0.0, -0.15,-0.2,0.0, -0.15,0.2,0.0,]),
        colors : obj1.colors.concat([0,0.7,0, 0,0.7,0, 0,0.7,0,]),
        indices : obj1.indices.concat([0,1,2,].map((value, index, array) => {return value + obj1.vertices.length/3}))
    }
}

function present(before_begin = false, after_end = false) {

    var coord = gl.getAttribLocation(shaderProgram, "coordinates");
    var color = gl.getAttribLocation(shaderProgram, "color");

    var triangles = mergeTriangles(paddle, ball, bricks);
    if(before_begin) {
        triangles = mergePlayButton(triangles);
    }

    //Buffer operations
    const vBuffer = gl.createBuffer();
    const indBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(triangles.vertices), gl.STATIC_DRAW);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(triangles.indices), gl.STATIC_DRAW);
    gl.vertexAttribPointer(coord, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(coord);
    
    const cBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(triangles.colors), gl.STATIC_DRAW);
    gl.vertexAttribPointer(color, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(color);

    gl.clearColor(0.6, 0.7, 0.6, 1);
    gl.enable(gl.DEPTH_TEST); 
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.viewport(0,0,canvas.width,canvas.height);
    gl.drawElements(gl.TRIANGLES, triangles.indices.length, gl.UNSIGNED_SHORT, 0);
}

function wall_collision() {
    var center_x = ball.vertices[0];
    var center_y = ball.vertices[1];
    var base_wall_collision = false;
    if((center_x + ball.radius >= 1) || (center_x - ball.radius <= -1)) {
        ball.direction.x *= -1;
    }
    if((center_y + ball.radius >= 1)) {
        ball.direction.y *= -1;
    }
    if(center_y - ball.radius <= -1) {
        base_wall_collision = true;
    }
    return base_wall_collision;
}

function paddle_collision() {
    var ball_center_x = ball.vertices[0];
    var ball_center_y = ball.vertices[1];
    var paddle_x_left = paddle.vertices[0];
    var paddle_x_right = paddle.vertices[6];
    var paddle_y_up = paddle.vertices[1];
    var paddle_y_down = paddle.vertices[4];
    if(ball_center_x>=paddle_x_left && ball_center_x<=paddle_x_right) {
        if(ball_center_y>=paddle_y_up && ball_center_y-ball.radius<=paddle_y_up) {
            if(ball.direction.y<0)
                ball.direction.y *= -1;
            else
                ball.direction.x *= -1;
        }
        if(ball_center_y<=paddle_y_down && ball_center_y+ball.radius>=paddle_y_down) {
            if(ball.direction.y>0)
                ball.direction.y *= -1;
            else
                ball.direction.x *= -1;
        }
    }
    else if(ball_center_y>=paddle_y_down && ball_center_y<=paddle_y_up) {
        if(ball_center_x<=paddle_x_left && ball_center_x+ball.radius>=paddle_x_left) {
            ball.direction.x *= -1;
        }
        if(ball_center_x>=paddle_x_right && ball_center_x-ball.radius<=paddle_x_right) {
            ball.direction.x *= -1;
        }
    }
    else if(Math.sqrt((ball_center_x-paddle_x_left)*(ball_center_x-paddle_x_left) + (ball_center_y-paddle_y_up)*(ball_center_y-paddle_y_up))<=ball.radius) {
        if(ball.direction.x>0)
            ball.direction.x *= -1;
        if(ball.direction.y<0)
            ball.direction.y *= -1;
    }
    else if(Math.sqrt((ball_center_x-paddle_x_right)*(ball_center_x-paddle_x_right) + (ball_center_y-paddle_y_up)*(ball_center_y-paddle_y_up))<=ball.radius) {
        if(ball.direction.x<0)
            ball.direction.x *= -1;
        if(ball.direction.y<0)
            ball.direction.y *= -1;
    }
    else if(Math.sqrt((ball_center_x-paddle_x_left)*(ball_center_x-paddle_x_left) + (ball_center_y-paddle_y_down)*(ball_center_y-paddle_y_down))<=ball.radius) {
        if(ball.direction.x>0)
            ball.direction.x *= -1;
        if(ball.direction.y>0)
            ball.direction.y *= -1;
    }
    else if(Math.sqrt((ball_center_x-paddle_x_right)*(ball_center_x-paddle_x_right) + (ball_center_y-paddle_y_down)*(ball_center_y-paddle_y_down))<=ball.radius) {
        if(ball.direction.x<0)
            ball.direction.x *= -1;
        if(ball.direction.y>0)
            ball.direction.y *= -1;
    }
}

function bricks_visible() {
    var n = bricks.length;
    for(let i=0;i<n;i++) {
        if(bricks[i].visible) {
            return true;
        }
    }
    return false;
}

function brick_collided(brick) {
    var ball_center_x = ball.vertices[0];
    var ball_center_y = ball.vertices[1];
    if(Math.sqrt((ball_center_x-brick.vertices[0])*(ball_center_x-brick.vertices[0]) + (ball_center_y-brick.vertices[1])*(ball_center_y-brick.vertices[1]))<=ball.radius) {
        if(ball.direction.x>0)
            ball.direction.x *= -1;
        if(ball.direction.y<0)
            ball.direction.y *= -1;
        return true;
    }
    if(Math.sqrt((ball_center_x-brick.vertices[3])*(ball_center_x-brick.vertices[3]) + (ball_center_y-brick.vertices[1])*(ball_center_y-brick.vertices[1]))<=ball.radius) {
        if(ball.direction.x<0)
            ball.direction.x *= -1;
        if(ball.direction.y<0)
            ball.direction.y *= -1;
        return true;
    }
    if(Math.sqrt((ball_center_x-brick.vertices[0])*(ball_center_x-brick.vertices[0]) + (ball_center_y-brick.vertices[7])*(ball_center_y-brick.vertices[7]))<=ball.radius) {
        if(ball.direction.x>0)
            ball.direction.x *= -1;
        if(ball.direction.y>0)
            ball.direction.y *= -1;
        return true;
    }
    if(Math.sqrt((ball_center_x-brick.vertices[3])*(ball_center_x-brick.vertices[3]) + (ball_center_y-brick.vertices[7])*(ball_center_y-brick.vertices[7]))<=ball.radius) {
        if(ball.direction.x<0)
            ball.direction.x *= -1;
        if(ball.direction.y>0)
            ball.direction.y *= -1;
        return true;
    }
    if(ball_center_x>=brick.vertices[0] && ball_center_x<=brick.vertices[3]) {
        if(ball_center_y>=brick.vertices[1] && ball_center_y-ball.radius<=brick.vertices[1]) {
            if(ball.direction.y<0)
                ball.direction.y *= -1;
            else
                ball.direction.x *= -1;
            return true;
        }
        if(ball_center_y<=brick.vertices[7] && ball_center_y+ball.radius>=brick.vertices[7]) {
            if(ball.direction.y>0)
                ball.direction.y *= -1;
            else
                ball.direction.x *= -1;
            return true;
        }
    }
    if(ball_center_y>=brick.vertices[7] && ball_center_y<=brick.vertices[1]) {
        if(ball_center_x<=brick.vertices[0] && ball_center_x+ball.radius>=brick.vertices[0]) {
            ball.direction.x *= -1;
            return true;
        }
        if(ball_center_x>=brick.vertices[3] && ball_center_x-ball.radius<=brick.vertices[3]) {
            ball.direction.x *= -1;
            return true;
        }
    }
    return false;
}

function bricks_collision() {
    var n = bricks.length;
    for(let i=0;i<n;i++) {
        if(bricks[i].visible && brick_collided(bricks[i])) {
            bricks[i].visible = false;
            score += bricks[i].score*10*level;
            document.getElementById("score").innerHTML = "Score : "+score;
        }
    }
}

function collision() {
    var base_wall_collision = wall_collision();
    if(base_wall_collision) {
        if(lives!=0) {
            lives -= 1;
            document.getElementById("lives").innerHTML = "Lives : "+lives;
        }
        return 0;
    }
    paddle_collision();
    var bricksExist = bricks_visible();
    if(!bricksExist) {
        level += 1;
        ball.speed *= 1.5;
        return 1;
    }
    bricks_collision();
    return 2;
}

function move_ball() {
    var sides = ball.sides;
    var game_status = collision();
    if(game_status == 2) {
        for(let i = 0; i<sides+1; i++) {
            ball.vertices[3*i] += ball.direction.x*ball.speed;
            ball.vertices[3*i+1] += ball.direction.y*ball.speed;
        }
    }
    return game_status;
}

function move_paddle_center(x) {
    if(x>=-1+(paddle.width/2) && x<= 1-(paddle.width/2)) {
        paddle.vertices[0] = x-(paddle.width/2);
        paddle.vertices[3] = x-(paddle.width/2);
        paddle.vertices[6] = x+(paddle.width/2);
        paddle.vertices[9] = x+(paddle.width/2);
    }
}

function move_paddle_left() {
    var speed = paddle.speed;
    if(paddle.vertices[0]-speed>=-1 && game_started) {
        paddle.vertices[0] -= speed;
        paddle.vertices[3] -= speed;
        paddle.vertices[6] -= speed;
        paddle.vertices[9] -= speed;
    } else if(game_started) {
        move_paddle_center(-1+(paddle.width/2));
    }
    paddle_collision();
}

function move_paddle_right() {
    var speed = paddle.speed;
    if(paddle.vertices[9]+speed<=1 && game_started) {
        paddle.vertices[0] += speed;
        paddle.vertices[3] += speed;
        paddle.vertices[6] += speed;
        paddle.vertices[9] += speed;
    } else if(game_started) {
        move_paddle_center(1-(paddle.width/2));
    }
    paddle_collision();
}

function keydown_eventhandler(e) {
    const key = e.keyCode;
    if(key == 37)
        move_paddle_left();
    else if(key == 39)
        move_paddle_right();
}

function keypress_eventhandler(e) {
    const key = e.key;
    if(key == "a")
        move_paddle_left();
    else if(key == "d")
        move_paddle_right();
}

function game_play() {
    var game_status = move_ball();
    if(game_status != 2) {
        game_stop(game_status);
    }
    else {
        present();
        animationId = window.requestAnimationFrame(game_play);
    }
}

function game_not_start(game_status) {
    if(game_status==1) {
        bricks = reset_bricks();
    }
    ball = reset_ball();
    paddle = reset_paddle();
    present(before_begin = true);
}

function delay(milliseconds){
    return new Promise(resolve => {
        setTimeout(resolve, milliseconds);
    });
}

async function game_stop(game_status) {
    game_started = false;
    await delay(2000);
    if(lives!=0) {
        game_not_start(game_status);
    }
}

function mouse_click(e) {
    let rect = canvas.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let x_range = rect.right - rect.left;
    x = x/x_range*2;
    x = x-1;
    let y = e.clientY - rect.top;
    let y_range = rect.bottom - rect.top;
    y = y/y_range*2;
    y = 1-y;
    return {x:x,y:y};
}

function mouse_click_start(e) {
    mouse = mouse_click(e)
    if(mouse.x >= -0.15 && mouse.x <= 0.15 && !game_started) {
        if(mouse.y >= 2*mouse.x/3 - 0.1 && mouse.y <= 0.1 - 2*mouse.x/3) {
            game_started = true;
            game_play();
        }
    }
}

function mouse_move(e) {
    if(game_started) {
        let rect = canvas.getBoundingClientRect();
        if(e.clientX<=rect.left) {
            move_paddle_center(-1+paddle.width/2);
        } else if (e.clientX>=rect.right) {
            move_paddle_center(1-paddle.width/2);
        }
        let x = e.clientX - rect.left;
        let x_range = rect.right - rect.left;
        x = x/x_range*2;
        x = x-1;
        if(x<=-1+paddle.width/2) {
            move_paddle_center(-1+paddle.width/2);
        } else if(x>=1-paddle.width/2) {
            move_paddle_center(1-paddle.width/2);
        } else {
            move_paddle_center(x);
        }
    }
}

restart_game();
document.getElementById("score").innerHTML = "Score : "+score;
window.onkeypress = keypress_eventhandler;
window.onkeydown = keydown_eventhandler;
canvas.onmousedown = mouse_click_start;
window.onmousemove = mouse_move;

