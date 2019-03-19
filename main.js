///////////////////////////////////////////////////////////////////////////////////////
//
//  BEGIN GestureHandler
// 
///////////////////////////////////////////////////////////////////////////////////////
const GestureHandler = function() {
  const sw = screen.width, sh = screen.height;
  const bounds = { c: [ sw / 3, sw / 3 * 2], r: [ sh * 0.4, sh * 0.6] };
  let _this = undefined;
  let _alias = {};
  let _knownRoutes = [];
  let _responseChain = [];
  let _defaultResponse;
  let _c1r1 = (x,y) => {
    const _map = (points, value)=>{
      for(let i=points.length-1; i>=0; i--){
        if(value>=points[i]) { return i+2; } 
      }  
      return 1;
    };
    let c1r1 = 'c' + _map(bounds.c, x) + 'r' + _map(bounds.r, y);
    return _alias[c1r1] || c1r1;
  };
  let _routeResponse = () => {
    let route = _this.path.toString();
    for(let i=0; i<_responseChain.length; i++){
      if(_responseChain[i].route === route){
        _responseChain[i].respond(_this, route);
        return;
      }
    }
  };
  let _registerMove = (x, y) => {
    let sector = _c1r1(x, y);
    if(!_this.path.isCurrent(sector)){
      if(_this.path.isPrevious(sector))           {
        _this.path.sectors.pop(); 
      } else {
        let projectedPath = _this.path.toString() + '.' + sector;
        if(_knownRoutes.some(route=>route.startsWith(projectedPath))){
          _this.path.sectors.push(sector);  
        }
      }
    }
    _this.delta.x = x - _this.start.x;
    _this.delta.y = y - _this.start.y; 
    _this.previous.x = _this.current.x;
    _this.previous.y = _this.current.x; 
    _this.current.x = x;
    _this.current.y = y;
    _this.current.dx = x - _this.previous.x;
    _this.current.dy = y - _this.previous.y;
    _routeResponse();
  };
  let _c1r1Alias = (c1r1, alias) => { _alias[c1r1] = alias; };
  let _isCurrent = (sector) => { 
        if(_this.path.sectors.length>0){
          return _this.path.sectors[_this.path.sectors.length-1] === sector;   
        }
        return false;
      };
  let _isPrevious = (sector) => { 
        if(_this.path.sectors.length>1){
          return _this.path.sectors[_this.path.sectors.length-2] === sector;   
        }
        return false;
      };
  let _registerRoute = function (/*path1, path2, ...*/) {
    let routes = Array.from(arguments);
    routes.forEach(proposed=>{
      if(_knownRoutes.some(known=>known===proposed)){
        throw proposed + ' route already registered';
      }
      _knownRoutes.push(proposed);  
    });
  };
  let _setTouchSurface = function(element){
    //draw sector boundaries
    element.width = sw;
    element.height = sh;
    var ctx = element.getContext("2d");
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.setLineDash([2, 4]);
    
    bounds.c.forEach(vertical=>{
      ctx.beginPath();
      ctx.moveTo(vertical, 0);
      ctx.lineTo(vertical, sh);
      ctx.stroke();  
    });
    
    bounds.r.forEach(horizontal=>{
      ctx.beginPath();
      ctx.moveTo(0, horizontal);
      ctx.lineTo(sw, horizontal);
      ctx.stroke();  
    });
    

    element.addEventListener("touchstart", _this.start, false);
    element.addEventListener("touchmove", _this.trace, false);
    element.addEventListener("touchend", _this.end, false);
  };
  
  return new function(){
    let adj_Y = 100;
    _this = this;
    _this.start = { x: 0, y: 0};
    _this.previous = { x: 0, y: 0};
    _this.current = { x: 0, y: 0};
    _this.delta = { x: 0, y: 0 };
    _this.path = { 
      sectors: [], 
      c1r1Alias: _c1r1Alias,
      registerRoute: _registerRoute,
      isCurrent: _isCurrent,
      isPrevious: _isPrevious,
      toString: () => { return _this.path.sectors.join('.'); }
    };
    _this.start = function (event) {
      if(event.touches.length===1){
        let t = event.touches[0];
        _this.path.sectors = [];
        _this.start.x = t.clientX;
        _this.start.y = t.clientY + adj_Y;
        _this.current.x = t.clientX;
        _this.current.y = t.clientY + adj_Y;
        _this.previous.x = t.clientX;
        _this.previous.y = t.clientY + adj_Y;
        let sector = _c1r1(t.clientX, t.clientY + adj_Y);
        _this.path.sectors.push(sector);
        if(_this.onstart){
          _this.onstart(_this);
        }
      }
      event.preventDefault();
    };
    _this.trace = function (event) {
      if(event.touches.length===1){
        _registerMove(event.touches[0].clientX, event.touches[0].clientY + adj_Y);
      }
      event.preventDefault();
    };
    _this.end = function(event) {
      _this.path.sectors = [];
      if(_this.onend){
        _this.onend(_this);
      }
    };
    _this.defaultResponse = (response) => {
      _defaultResponse = response;
    };
    _this.mapResponse = function (response, routeargs) {
      if(arguments.length<2){
        throw 'usage: mapResponse(handler, route1 , route2, route3 ...)';
      }
      for(let i = 1; i<arguments.length; i++){
        let route = arguments[i];
        if(_responseChain.some(rr=>rr.route===route)) {
          throw 'Response route ' + route + ' is already registered';
        }
        _responseChain.push({ route:route, respond: response});  
      }
    };
    
    _this.setTouchSurface = _setTouchSurface;
    
    return _this;
  };
};
///////////////////////////////////////////////////////////////////////////////////////
//
//  END GestureHandler
// 
///////////////////////////////////////////////////////////////////////////////////////

const gesture = new GestureHandler();
const touchpad = document.getElementById('touchpad');
const leftstatus = document.getElementById('leftstatus');
const rightstatus = document.getElementById('rightstatus');
const leftcomp  = document.getElementById('leftcomp');
const rightcomp = document.getElementById('rightcomp');
const routeinfo = document.getElementById('routeinfo');
const info = document.getElementById('info');
const throttle = { leftcompensation: 0, rightcompensation: 0 };

var ws;
var prevmsg;

Number.prototype.padzeros = function(n) { return this.toString().padStart(n, 0); };

function initGestureControl(){
  gesture.path.c1r1Alias('c1r1', 'FL');
  gesture.path.c1r1Alias('c2r1', 'F');
  gesture.path.c1r1Alias('c3r1', 'FR');
  gesture.path.c1r1Alias('c1r2', 'L');
  gesture.path.c1r1Alias('c2r2', 'N');
  gesture.path.c1r1Alias('c3r2', 'R');
  gesture.path.c1r1Alias('c1r3', 'BL');
  gesture.path.c1r1Alias('c2r3', 'B');
  gesture.path.c1r1Alias('c3r3', 'BR');
  gesture.path.registerRoute('N.F.FR');
  gesture.path.registerRoute('N.F.FL');
  gesture.path.registerRoute('N.B.BR');
  gesture.path.registerRoute('N.B.BL');
  gesture.path.registerRoute('N.R');
  gesture.path.registerRoute('N.L');
  gesture.path.registerRoute('N.F.FR.N', 'N.F.FR.B', 'N.B.BR.N', 'N.B.BR.F');
  gesture.path.registerRoute('N.F.FL.N', 'N.F.FL.B', 'N.B.BL.N', 'N.B.BL.F');
  gesture.onstart = () => { throttle.left = 0; throttle.right = 0; };
  gesture.onend = (g) => { 
    throttle.left = 0; 
    throttle.right = 0; 
    throttle.leftcompensation = 0; 
    throttle.rightcompensation = 0; 
    sendThrottle(); 
  };
  gesture.setTouchSurface(touchpad);
  
}

function init() {
  
  ws = new WebSocket('ws:/' + '/' + window.location.hostname + ':81/');
  ws.onopen = function (evt) { ws.send('rdy'); };
  ws.onclose = function (evt) { };
  ws.onerror = function (evt) { };
  ws.onmessage = function (evt) { };

  initGestureControl();
  
  const thr_range = screen.height / 2;
  const min = Math.min, max = Math.max, abs = Math.abs, hypot = Math.hypot;
  let getlag = (throwlength, dx, fasttrack, allowreverse) => {
    //inverse sensitivity to throttle
    //i.e. subtract less of x delta the higher the speed
    let magnitude = (1 - abs(fasttrack) * 0.5);
    let lag = ((abs(throwlength) - abs(dx) * magnitude) / abs(throwlength));
    let laggingthrow = throwlength * lag;
    info.innerHTML = 'fast: ' + throwlength.toFixed(2) + ' throw: ' + laggingthrow.toFixed(2);
    return lag;
  };
  
  let reduceComp = (reduction) => {
    //reduce the compensation amount proportionally to velocity of the moving touch
    if(throttle.leftcompensation>0) {
      throttle.leftcompensation -= reduction;
      if(throttle.leftcompensation<0) { throttle.leftcompensation=0; }
    } else if(throttle.leftcompensation<0) {
      throttle.leftcompensation += reduction;
      if(throttle.leftcompensation>0) { throttle.leftcompensation=0; }
    }
    if(throttle.rightcompensation>0) {
      throttle.rightcompensation -= reduction;
      if(throttle.rightcompensation<0) { throttle.rightcompensation=0; }
    } else if(throttle.rightcompensation<0) {
      throttle.rightcompensation += reduction;
      if(throttle.rightcompensation>0) { throttle.rightcompensation=0; }
    }
  };
  
  gesture.mapResponse((g, route) => {
    let throwlength = g.start.y - g.current.y;
    if(throwlength===0) { return; }
    let fast = min(throwlength / thr_range, 1);
    let lag = getlag(throwlength, g.delta.x, fast);
    let slow = fast * lag;
    if(throttle.rightlocked){
      throttle.leftcompensation = throttle.leftlockspeed - fast;
      throttle.rightcompensation = throttle.right - slow;
    }
    if(throttle.leftlocked){
      throttle.rightcompensation = throttle.rightlockspeed - fast;
      throttle.leftcompensation = throttle.left - slow;
    }
    throttle.left = (g.delta.x > 0 ? fast : slow) + throttle.leftcompensation;
    throttle.right = (g.delta.x > 0 ? slow : fast) + throttle.rightcompensation
    if(throttle.leftcompensation!==0 || throttle.rightcompensation!==0)
    {
      reduceComp(0.05);
    }
    throttle.leftlocked = false;
    throttle.rightlocked = false;
    sendThrottle();
  }, 'N', 'N.F', 'N.B');

  gesture.mapResponse((g, route) => {
      let thrr = min((g.start.y - g.current.y) / thr_range, 1);
      let thrl = -thrr;
      throttle.left = thrl;
      throttle.right = thrr;
      sendThrottle();
    }, 'N.R');
  
  gesture.mapResponse((g, route) => {
      let thrl = min((g.start.y - g.current.y) / thr_range, 1);
      let thrr = -thrl;
      throttle.left = thrl;
      throttle.right = thrr;
      sendThrottle();
    }, 'N.L');
  
  gesture.mapResponse((g, route) => {
    if(!throttle.rightlocked){
        throttle.leftlockspeed = throttle.left;
        throttle.rightlockspeed = throttle.right;
        throttle.rightlockpivot = g.current.y;
        throttle.rightlocked = true;
    }
    let secondary = (g.current.y - throttle.rightlockpivot) / thr_range;
    throttle.right = throttle.rightlockspeed - secondary;  
    sendThrottle();
  }, 'N.F.FR', 'N.B.BR');
  
  gesture.mapResponse((g, route) => {
    if(!throttle.leftlocked){
        throttle.leftlockspeed = throttle.left;
        throttle.rightlockspeed = throttle.right;
        throttle.leftlockpivot = g.current.y;
        throttle.leftlocked = true;
    }
    let secondary = (g.current.y - throttle.leftlockpivot) / thr_range;
    throttle.left = throttle.leftlockspeed - secondary;  
    sendThrottle();
  }, 'N.F.FL', 'N.B.BL');

  gesture.mapResponse((g, route) => {
    let current = g.path.sectors[g.path.sectors.length-1];
    g.path.sectors = [];
    g.path.sectors.push('N');
    if(current!=='N'){
      g.path.sectors.push(current);
    }
  }, 'N.F.FR.N', 
     'N.F.FR.B', 
     'N.B.BR.N', 
     'N.B.BR.F',
     'N.F.FL.N', 
     'N.F.FL.B', 
     'N.B.BL.N', 
     'N.B.BL.F');
}

function sendThrottle() {
    let dirl = throttle.left > 0 ? 1 : 0;
    let thrl = Math.floor(Math.min(Math.abs(throttle.left) * 100, 100));
    let dirr = throttle.right > 0 ? 1 : 0;
    let thrr = Math.round(Math.min(Math.abs(throttle.right) * 100, 100));
	  let msg = "thr." + dirl + "." + thrl.padzeros(3) + "." + dirr + "." + thrr.padzeros(3);
    routeinfo.innerHTML = gesture.path.toString();
    if(msg!==prevmsg){
      leftstatus.innerHTML = (dirl===0 ? '-' : '') + thrl;
      leftcomp.innerHTML = throttle.leftcompensation.toFixed(2);
      rightstatus.innerHTML = (dirr===0 ? '-' : '') + thrr;
      rightcomp.innerHTML = throttle.rightcompensation.toFixed(2);
      ws.send(msg);
      prevmsg = msg;
    }
}

init();
