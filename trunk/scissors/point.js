function Point(x,y) {
	this.x = x;
	this.y = y;
}

Point.prototype.equals = function(q) {
	if ( !q ) {
		return false;
	}
	
	return (this.x == q.x) && (this.y == q.y);
};

Point.prototype.toString = function() {
	 return "(" + this.x + ", " + this.y + ")";
};

Point.prototype.dist = function(p) {
	return Math.sqrt(Math.pow(this.x-p.x,2) + Math.pow(this.y-p.y,2));
};

Point.prototype.index = function(width) {
	return this.y*width + this.x;
};

function index(i, j, width) {
	return i*width + j;
}

function fromIndex(idx, width) {
	return new Point(idx % width, Math.floor(idx / width));
}

function translate(p, tx, ty) {
	if ( !p ) {
		return p;
	}
	
	return new Point(p.x + tx, p.y + ty);
}

//Converts absolute coordinates to element coordinates.
function getRelativePoint (element, x, y) {
	var p = new Point(0, 0);
	
	// Compute canvas offset.
	while (element) {
		p.x += element.offsetLeft;
		p.y += element.offsetTop;
		element = element.offsetParent;
	}

	p.x = x - p.x + window.pageXOffset;
	p.y = y - p.y + window.pageYOffset;

	return p;
};