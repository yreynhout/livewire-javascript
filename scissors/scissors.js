// Created: A while ago

function Scissors() {

// Member variables
var _this = this // For event functions.

this.lineColor = new Array(255, 0, 0, 255);

this.output = null; // Element to stick output text

this.image_canvas = null; // Canvas for drawing image
this.line_canvas = null; // Canvas for drawing commited lines
this.scratch_canvas = null; // Canvas for drawing preview lines

this.image_ctx = null;
this.line_ctx = null;
this.scratch_ctx = null;

this.scissorsWorker = null;
this.trainCheck = null;

this.mousePoint = null;
this.exampleLineDrawn = false;

this.isDrawing = false;

this.snapSize = 2;
this.startPointSize = 4;
this.start = null;
this.overStart = false;

this.imageUrl = null;
this.img = null;

this.paths = new Array(); // Array of completed paths.
this.currentPath = new Array(); // Array of subpaths (which are arrays of points)
// Note: each subpath goes backwards, from the destination to the source.

// Creates a new canvas element and adds it to the DOM
this.createCanvas = function(id, zIndex) {
	var imageNode = this.img;

	var canvas = document.createElement("canvas");
	canvas.id = id
	canvas.width = imageNode.width;
	canvas.height = imageNode.height;
	
	var style = canvas.style
	style.position = "absolute";
	style.top = "0px";
	style.left = "0px";
	style.zIndex = zIndex;
	
	if ( imageNode.nextSibling ) {
		imageNode.parentNode.insertBefore(canvas, imageNode.nextSibling);
	} else {
		imageNode.parentNode.appendChild(canvas)
	}
	
	return canvas;
}

// Converts absolute coordinates to canvas coordinates.
this.getCanvasPoint = function(canvas, x, y) {
	var p = new Point(0, 0);
	
	// Compute canvas offset.
	var element = this.image_canvas;
	while (element) {
		p.x += element.offsetLeft;
		p.y += element.offsetTop;
		element = element.offsetParent;
	}

	p.x = x - p.x + window.pageXOffset;
	p.y = y - p.y + window.pageYOffset;

	return p;
}

// Initializes everything, creates all of the canvases, and starts the Web
// Workers.
this.init = function(img) {
	this.img = img;
	
	this.trainCheck = document.getElementById("trainCheck");
	this.output = document.getElementById("output");
	
	this.image_canvas = this.createCanvas("image_canvas", 0);
	this.line_canvas = this.createCanvas("line_canvas", 1);
	this.scratch_canvas = this.createCanvas("scratch_canvas", 2);
	this.image_ctx = this.image_canvas.getContext("2d");
	this.line_ctx = this.line_canvas.getContext("2d");
	this.scratch_ctx = this.scratch_canvas.getContext("2d");
	
	this.image_canvas.width = this.img.naturalWidth;
	this.image_canvas.height = this.img.naturalHeight;
	this.line_canvas.width = this.image_canvas.width;
	this.line_canvas.height = this.image_canvas.height;
	this.scratch_canvas.width = this.image_canvas.width;
	this.scratch_canvas.height = this.image_canvas.height;
	
	this.image_ctx.drawImage(this.img, 0, 0, this.image_canvas.width, this.image_canvas.height);
	
	this.scissorsWorker = new ScissorsWorker("scissors/scissorsWorker.js");

	this.scissorsWorker.onstatus = function(msg) {
		_this.output.textContent = msg;
	};
	
	this.scissorsWorker.ondata = function(data) {
		if ( _this.isDrawing && !_this.exampleLineDrawn && _this.mousePoint ) {
			// If we haven't drawn the path to the current mouse point...
			
			// ...and we can draw that path.
			if ( _this.scissorsWorker.hasPathFor(_this.mousePoint) ) {
				// Draw it!
				var imageData = _this.scratch_ctx.createImageData(scratch_canvas.width, scratch_canvas.height);
				_this.drawPathFrom(_this.mousePoint, imageData);
				_this.scratch_ctx.putImageData(imageData, 0, 0);
			}
		}
	};
	
	this.scissorsWorker.onerror = function(event){
		output.textContent = event.message;
		
		throw new Error(event.message + " (" + event.filename + ":" + event.lineno + ")");
	};
	
	var imageData = this.image_ctx.getImageData(0,0, this.image_canvas.width, this.image_canvas.height);
	
	this.scissorsWorker.setImageData(imageData);
	
	this.scratch_canvas.addEventListener("mousemove", this.mouseMove, false);
	this.scratch_canvas.addEventListener("mousedown", this.mouseClick, true);
	this.scratch_canvas.addEventListener("contextmenu", function (event) {
		event.preventDefault();
	});
}

// Aborts the current computation and stops showing potential paths
this.stopDrawing = function() {
	this.isDrawing = false;
	this.scissorsWorker.stop();
	this.scissorsWorker.resetTraining();
	this.scratch_ctx.clearRect(0, 0, this.scratch_canvas.width, this.scratch_canvas.height);
	
	if ( this.currentPath.length > 0 ) {
		this.paths.push(this.currentPath);
		this.currentPath = new Array();
	}
	
	this.start = null;
}

// Puts this object in the drawing state
this.drawing = function(p) {
	this.isDrawing = true;
	this.start = p;
}

// Deletes all of the saved lines so far
this.clearLines = function() {
	this.stopDrawing();
	this.paths = new Array(); // Clear stored paths
	this.line_ctx.clearRect(0, 0, this.line_canvas.width, this.line_canvas.height);
	
	this.start = null;
}

// Updates whether the algorithm should do live training, according to the
// trainCheck's value
this.setTraining = function() {
	this.scissorsWorker.setTraining(this.trainCheck.value);
}

// Returns true if the last path saved is closed (i.e., its last point is
// equal to its first).
this.isClosed = function() {
	// Closed attribute of most recent path, if any
	if ( this.isDrawing ) {
		return this.isPathClosed(this.currentPath);
	} else if ( this.paths.length > 0 ) {
		return this.isPathClosed(this.paths[this.paths.length-1]);
	} else {
		return false;
	}
}

// Returns whether the supplied path is closed
this.isPathClosed = function(path) {
	return path.length > 0
		&& this.getFirstPoint(path).equals(this.getLastPoint(path));
}

// Set to true, and the algorithm will not allow the user to submit without
// drawing a closed path, or add a new path once one is closed
this.setRequiresClosed = function(req) {
	this.reqClosed = req;
}

this.requiresClosed = function() {
	return this.reqClosed;
}

// Returns true if the supplied point is considered to be over the start point
// of the current path
this.isOverStart = function(p) {
	return this.start && this.start.dist(p) < this.startPointSize;
}

// Returns the last point in the supplied path (array of subpaths)
this.getLastPoint = function(path) {
	return path[path.length-1][0];
}

// Returns the first point in the supplied path (array of subpaths)
this.getFirstPoint = function(path) {
	return path[0][path[0].length-1];
}

// Attempts to snap the supplied point to either the starting point or a point
// with high gradient magnitude.
this.snapPoint = function(p) {
	var gradient = this.scissorsWorker.gradient; // Inverted gradient.
	
	if ( this.requiresClosed() && this.isOverStart(p) ) {
		return this.start; // We're close enough to snap to start
	}
	
	if ( gradient == null ) {
		return p; // Don't have enough data to snap to anything else.
	}
	
	var sx = Math.max(0, p.x-this.snapSize);
	var sy = Math.max(0, p.y-this.snapSize);
	var ex = Math.min(gradient.width-1, p.x+this.snapSize);
	var ey = Math.min(gradient.height-1, p.y+this.snapSize);
	
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

// Captures mouse clicks and either updates the path, starts a new one, and/or
// finishes the current one.
this.mouseClick = function(event) {
	var p = _this.getCanvasPoint(_this.scratch_canvas, event.clientX, event.clientY);
	
	if ( !event.ctrlKey ) {
		p = _this.snapPoint(p);
	}
	
	if ( event.button == 2 && _this.requiresClosed() && _this.isDrawing ) {
		// Right mouse button
		// close path.
		_this.currentPath.push(_this.getLine(_this.start, _this.getLastPoint(_this.currentPath)));
		_this.stopDrawing();
		_this.redrawPaths();
	} else if ( event.button == 0 ) { // Left mouse button
		if ( _this.isDrawing && _this.scissorsWorker.hasPathFor(p) ) {
			// If we're drawing, and the chosen point has it's path calculated
			// add path to point and continue
			var imageData = _this.line_ctx.getImageData(0, 0, _this.line_canvas.width, _this.line_canvas.height);
			_this.drawPathFrom(p, imageData);
			_this.appendPath(p, _this.currentPath);
			_this.line_ctx.putImageData(imageData, 0, 0);
			
			_this.scissorsWorker.setPoint(p);
		}
		
		// Stop drawing if the user requests it (and we can), or when the path is
		// finished
		if ( (event.shiftKey && _this.isDrawing && !_this.requiresClosed())
				|| (_this.requiresClosed() && _this.isClosed()) ) {
			_this.stopDrawing();
			_this.redrawPaths();
		} else if ( !_this.isDrawing ) {
			if ( _this.requiresClosed() && _this.isClosed() ) {
				window.alert('Path is already closed. Click "Undo" or "Clear Lines" to change the path.')
			}
			
			// Start drawing new segment
			_this.drawing(p);
			_this.drawStart();
			_this.scissorsWorker.setPoint(p);
		}
	}
}

// Captures mouse movement and updates preview paths accordingly 
this.mouseMove = function(event) {
	if ( _this.isDrawing ) {
		var p = _this.getCanvasPoint(scratch_canvas, event.clientX, event.clientY);
		//start = getSearchPoint(start);
		
		if ( !event.ctrlKey ) {
			p = _this.snapPoint(p);
		}
		
		_this.mousePoint = p;
		_this.exampleLineDrawn = _this.scissorsWorker.hasPathFor(_this.mousePoint);
		
		var imageData = _this.scratch_ctx.createImageData(_this.scratch_canvas.width, _this.scratch_canvas.height);
		_this.drawPathFrom(p, imageData);
		_this.scratch_ctx.putImageData(imageData, 0, 0);
		
		_this.overStart = _this.isOverStart(p)
		_this.drawStart();
	}
}

// Draws a line from the supplied point to the start point onto the supplied
// ImageData object.
this.drawPathFrom = function(p, imageData) {
	var subpath = this.scissorsWorker.getPathFrom(p);
	
	for ( var i = 0; i < subpath.length; i++ ) {
		var idx = (subpath[i].y*imageData.width + subpath[i].x)*4;
		
		// Set pixel color
		for ( var j = 0; j < 4; j++ ) {
			imageData.data[idx+j] = this.lineColor[j];
		}
	}
}

// Draws the supplied path onto the ImageData object.
this.drawPath = function(path, imageData) {
	for ( var i = 0; i < path.length; i++ ) { // Iterate over subpaths
		for ( var j = 0; j < path[i].length; j++ ) { // and points.
			var p = path[i][j];
			idx = (p.y*imageData.width + p.x)*4; // 4 bytes per pixel
			
			// Set pixel color
			for ( var k = 0; k < 4; k++ ) {
				imageData.data[idx+k] = this.lineColor[k];
			}
		}
	}
}

// Draws a circle representing the starting point of the current path.
this.drawStart = function() {
	if ( this.start && this.requiresClosed() ) {
		this.line_ctx.beginPath();
		this.line_ctx.arc(this.start.x, this.start.y, this.startPointSize, 0, 2*Math.PI);
		this.line_ctx.fill();
		this.line_ctx.stroke();
	}
}

// Appends the subpath from the supplied point to the previous clicked point to
// the supplied path array
this.appendPath = function(p, path) {
	subpath = this.scissorsWorker.getPathFrom(p);
	path.push(subpath);
}

// Bresenham's algorithm for constructing a straight line between two points.
// Thank you, Phrogz, from StackOverflow.
this.getLine = function(p, q) {
	var line = new Array();
	
	// For faster access
	px = p.x; py = p.y;
	qx = q.x; qy = q.y;
	
	var dx = Math.abs(qx-px);
	var dy = Math.abs(qy-py);
	var sx = (px < qx) ? 1 : -1;
	var sy = (py < qy) ? 1 : -1;
	var err = dx - dy;

	while( (px != qx) || (py != qy) ) {

		// Do what you need to for this
		line.push(new Point(px, py));

		var e2 = 2 * err;
		
		if ( e2 > -dy ){
			err -= dy;
			px  += sx;
		}
		
		if ( e2 < dx ){
			err += dx;
			py  += sy;
		}
	}
	
	line.push(new Point(px, py));
	return line;
}

// Undoes the previously commited line
this.undo = function() {
	// Remove last path component and redraw
	if ( this.isDrawing && this.currentPath.length == 0 ) {
		this.stopDrawing();
	} else {
		this.stopDrawing();
		if ( this.paths.length > 0 ) {
			var path = this.paths[this.paths.length - 1]; // Last element
			var removed = path.pop();
			
			// Start drawing from the start of the removed path
			this.scissorsWorker.setPoint(removed[removed.length-1]);

			this.currentPath = this.paths.pop(); // currentPath = path
			if ( this.currentPath.length > 0 ) {
				this.drawing(this.getFirstPoint(this.currentPath));
			} else {
				this.drawing(removed[removed.length-1]);
			}
		}
	}
	
	this.redrawPaths();
}

// Redraws everything except the image canvas
this.redrawPaths = function() {
	// Create fresh canvas
	var imageData = this.line_ctx.createImageData(this.line_canvas.width, this.line_canvas.height);
	
	for ( var i = 0; i < this.paths.length; i++ ) { // Iterate over paths...
		// and draw
		this.drawPath(this.paths[i], imageData);
	}

	// Redraw start point and current path
	if ( this.currentPath && this.currentPath.length > 0 ) {
		var subpath = this.currentPath[0];
		this.drawPath(this.currentPath, imageData);
	}
	
	this.line_ctx.putImageData(imageData, 0, 0);
	this.drawStart(); // Must draw straight to canvas
}

// Completely replaces the paths array
this.setPaths = function(paths) {
	this.stopDrawing();
	this.paths = paths;
	this.redrawPaths();
}

// Attempts to encode the current paths array and add it to the scissors_form
// form object.
this.submitScissors = function() {
	if ( this.requiresClosed() && !this.isClosed() ) {
		window.alert("Outline must form a complete loop, which it currently doesn't.")
		return false; // Cancel submission
	}
	
	var form = document.getElementById('scissors_form');
	
	// Create hidden form element for path
	var pathInput = document.createElement('input');
	pathInput.setAttribute('type', 'hidden');
	pathInput.setAttribute('name', 'paths');
	pathInput.setAttribute('value', JSON.stringify(paths));
	
	form.appendChild(pathInput);
	return true;
}

}


