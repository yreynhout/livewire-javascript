function getStaticOffset(element) {
	offset = new Object();
	offset.x = 0;
	offset.y = 0;

	return offset;
}

function getCanvasPoint(canvas, x, y) {
	// Convert absolute coordinates to canvas coordinates.
	p = new Object();
	p.x = 0;
	p.y = 0;
	
	// Compute canvas offset.
	element = image_canvas;
	while (element) {
		p.x += element.offsetLeft;
		p.y += element.offsetTop;
		element = element.offsetParent;
	}

	p.x = x - p.x + window.pageXOffset;
	p.y = y - p.y + window.pageYOffset;

	return p;
}

var lineColor = new Array(255, 0, 0, 255);

var output = null;
var image_canvas = null;
var line_canvas = null;
var scratch_canvas = null;
var image_ctx = null;
var line_ctx = null;
var scratch_ctx = null;
var scissorsWorker = null;
//var searchSizeBox = null;
var trainCheck = null;

var mousePoint = null;
var mousePointParent = null;

var isDrawing = false;

var snapSize = 2;

var imageUrl = null;

function PathPoint(path, point) {
	this.path = path;
	this.point = point;
}

var paths = new Array(); // Array of completed paths.
var currentPath = new Array();

function pageLoaded() {
	//searchSizeBox = document.getElementById("searchSize");
	trainCheck = document.getElementById("trainCheck");
	
	output = document.getElementById("output");
	
	image_canvas = document.getElementById("image_canvas");
	line_canvas = document.getElementById("line_canvas");
	scratch_canvas = document.getElementById("scratch_canvas");
	image_ctx = image_canvas.getContext("2d");
	line_ctx = line_canvas.getContext("2d");
	scratch_ctx = scratch_canvas.getContext("2d");
	
	loadImage(img_url); // img_url set externally
}

function loadImage() {
	img = new Image();

	img.onload = function() {
		imageLoaded();
	};

	img.setAttribute("src", img_url);
}

function imageLoaded() {
	// image_canvas.width = 800;
	// image_canvas.height = img.naturalHeight / img.naturalWidth * canvas.width;
	image_canvas.width = img.naturalWidth;
	image_canvas.height = img.naturalHeight;
	line_canvas.width = image_canvas.width;
	line_canvas.height = image_canvas.height;
	scratch_canvas.width = image_canvas.width;
	scratch_canvas.height = image_canvas.height;
	
	image_ctx.drawImage(img, 0, 0, image_canvas.width, image_canvas.height);
	
	scissorsWorker = new ScissorsWorker("/static/js/scissors/scissorsWorker.js");
	
	//searchSizeBox.value = scissorsWorker.getSearchSize();
	
	scissorsWorker.onstatus = function(msg) {
		output.textContent = msg;
	};
	
	scissorsWorker.ondata = function(data) {
		//pathPoints.push(new PathPoint(data, scissorsWorker.getPoint()));
		
		if ( isDrawing && !mousePointParent && mousePoint ) {
			// If we haven't drawn the path to the current mouse point...
			
			var curParent = scissorsWorker.getParentPoint(mousePoint);
			if ( curParent ) { // ...and we can draw that path.
				// Draw it!
				var imageData = scratch_ctx.createImageData(scratch_canvas.width, scratch_canvas.height);
				drawPath(mousePoint, imageData);
				scratch_ctx.putImageData(imageData, 0, 0);
			}
		}
	};
	
	//scissorsWorker.onerror = function(event){
		//output.textContent = event.message;
		
		//throw new Error(event.message + " (" + event.filename + ":" + event.lineno + ")");
	//};
	
	imageData = image_ctx.getImageData(0,0, image_canvas.width, image_canvas.height);
	
	scissorsWorker.setImageData(imageData);
	
	scratch_canvas.addEventListener("mousemove", mouseMove, false);
	scratch_canvas.addEventListener("mouseup", mouseClick, false);
}

function stopDrawing() {
	isDrawing = false;
	scissorsWorker.stop();
	scissorsWorker.resetTraining();
	scratch_ctx.clearRect(0, 0, scratch_canvas.width, scratch_canvas.height);
	
	if ( currentPath.length > 0 ) {
		paths.push(currentPath);
		currentPath = new Array();
	}
}

function drawing() {
	isDrawing = true;
}

function clearLines() {
	stopDrawing();
	paths = new Array(); // Clear stored paths
	line_ctx.clearRect(0, 0, line_canvas.width, line_canvas.height);
}

// No longer used.
function processSearchSizeBox() {
	var searchSize = parseInt(searchSizeBox.value);
	scissorsWorker.setSearchSize(searchSize);
	stopDrawing();
}

function setTraining() {
	scissorsWorker.setTraining(trainCheck.value);
}

// Snap point inside of search square. No longer used.
function getSearchPoint(p) {
	var cp = scissorsWorker.getPoint();
	
	if ( cp == null ) {
		return p;
	}
	
	var size = scissorsWorker.getSearchSize();
	
	var d = new Object();
	d.x = p.x - cp.x; d.y = p.y - cp.y;
	
	if ( d.x < size && d.x > -size && d.y < size && d.y > -size ) {
		// Inside of square
		return p;
	}
	
	//var q = new Object(); // Return value.
	//q.x = p.x;
	//q.y = p.y;
	
	var slope = 0;
	var sgn = 0;
	
	if ( d.x > size || d.x < -size  ) {
		// Adjust horizontally.
		slope = d.y / d.x;
		sgn = ((d.x < 0)? -1 : 1);
		
		tx = size * sgn; // Edge
		d.y = Math.floor(d.y - slope * (d.x - tx)) - sgn;
		d.x = tx;
	}
	if ( d.y > size || d.y < -size ) {
		// Adjust vertically.
		slope = d.x / d.y;
		sgn = ((d.y < 0)? -1 : 1);
		
		ty = size * sgn; // Edge
		d.x = Math.floor(d.x - slope * (d.y - ty)) - sgn;
		d.y = ty;
	}
	
	// var q = new Object();
	// q.x = Math.min(Math.max(p.x, cp.x - searchSize), cp.x + searchSize);
	// q.y = Math.min(Math.max(p.y, cp.y - searchSize), cp.y + searchSize);
	
	//console.log(d.x + ", " + d.y);
	
	var q = new Object();
	q.x = cp.x + d.x; q.y = cp.y + d.y;
	
	return q;
}

function snapPoint(p) {
	var gradient = scissorsWorker.gradient; // Inverted gradient.
	
	if ( gradient == null ) {
		return p;
	}
	
	var cp = scissorsWorker.getPoint();
	if ( cp == null ) {
		cp = {'x':0, 'y':0};
	}
	
	var sx = Math.max(0, cp.x-scissorsWorker.searchSize, p.x-snapSize);
	var sy = Math.max(0, cp.y-scissorsWorker.searchSize, p.y-snapSize);
	var ex = Math.min(imageData.width-1, cp.x+scissorsWorker.searchSize, p.x+snapSize);
	var ey = Math.min(imageData.height-1, cp.y+scissorsWorker.searchSize, p.y+snapSize);
	
	var maxGrad = gradient[p.y][p.x];
	var maxPoint = p;
	for ( var y = sy; y <= ey; y++ ) {
		for ( var x = sx; x <= ex; x++ ) {
			if ( gradient[y][x] < maxGrad ) {
				maxGrad = gradient[y][x];
				maxPoint.x = x; maxPoint.y = y;
			}
		}
	}
	
	return maxPoint;
}

function mouseClick(event) {
	var start = getCanvasPoint(scratch_canvas, event.clientX, event.clientY);
	
	//start = getSearchPoint(start);
	
	if ( !event.ctrlKey ) {
		start = snapPoint(start);
	}
		
	if ( isDrawing && scissorsWorker.getParentPoint(start) != undefined ) {
		// If we're drawing, and the chosen point has it's path calculated.
		var imageData = line_ctx.getImageData(0, 0, line_canvas.width, line_canvas.height);
		drawPath(start, imageData);
		appendPath(start, currentPath);
		line_ctx.putImageData(imageData, 0, 0);
	}
	
	if ( event.shiftKey && isDrawing ) {
		stopDrawing();
	} else {
		drawing();
		scissorsWorker.setPoint(start);
	}
}

function mouseMove(event) {
	if ( isDrawing ) {
		var start = getCanvasPoint(scratch_canvas, event.clientX, event.clientY);
		//start = getSearchPoint(start);
		
		if ( !event.ctrlKey ) {
			start = snapPoint(start);
		}
		
		mousePoint = start;
		mousePointParent = scissorsWorker.getParentPoint(mousePoint);
		
		var imageData = scratch_ctx.createImageData(scratch_canvas.width, scratch_canvas.height);
		drawPath(start, imageData);
		scratch_ctx.putImageData(imageData, 0, 0);
	}
}

function drawPath(p, imageData) {
	while (p) {
		idx = (p.y*imageData.width + p.x)*4;
		
		//// Opaque red:
		//imageData.data[idx] = 255;
		//imageData.data[idx+1] = 0;
		//imageData.data[idx+2] = 0;
		//imageData.data[idx+3] = 255;
		
		// Set pixel color
		for ( var i = 0; i < 4; i++ ) {
			imageData.data[idx+i] = lineColor[i];
		}
		
		p = scissorsWorker.getParentPoint(p);
	}
}

function appendPath(p, path) {
	subpath = Array();
	
	while (p) {
		subpath.push({x: p.x, y: p.y});
		p = scissorsWorker.getParentPoint(p);
	}
	
	path.push(subpath);
}

function undo() {
	// Remove last path component and redraw
	stopDrawing(); // Stop drawing and commit current path
	
	if ( paths.length > 0 ) {
		subpath = paths[paths.length - 1]; // Last element
		subpath.pop();
		
		if ( subpath.length == 0 ) {
			paths.pop(); // Remove empty path
		}
		
		redrawPaths();
	}
}

function redrawPaths() {
	
	// Create fresh canvas
	var imageData = line_ctx.createImageData(line_canvas.width, line_canvas.height);
	
	for ( var i = 0; i < paths.length; i++ ) { // Iterate over paths...
		for ( var j = 0; j < paths[i].length; j++ ) { // subpaths...
			for ( var k = 0; k < paths[i][j].length; k++ ) { // and points.
				var p = paths[i][j][k];
				idx = (p.y*imageData.width + p.x)*4;
				
				// Set pixel color
				for ( var l = 0; l < 4; l++ ) {
					imageData.data[idx+l] = lineColor[l];
				}
			}
		}
	}
	
	line_ctx.putImageData(imageData, 0, 0);
}

function submitScissors() {
	var form = document.getElementById('scissors_form');
	
	// Create hidden form element for path
	var pathInput = document.createElement('input');
	pathInput.setAttribute('type', 'hidden');
	pathInput.setAttribute('name', 'paths');
	pathInput.setAttribute('value', JSON.stringify(paths));
	
	form.appendChild(pathInput);
}




