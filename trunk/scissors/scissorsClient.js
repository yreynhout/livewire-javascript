
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
}

function Message(msgType) {
	this.msgType = msgType;
};

Message.GRADIENT  = -4;
Message.RESULTS   = -3;
Message.WORKING   = -2;
Message.STATUS    = -1;

Message.ERROR     =  0;

Message.POINT	  =  1;
Message.CONTINUE  =  2;
Message.STOP      =  3;
Message.IMAGE 	  =  4;
Message.RESET     =  5;
Message.TRAIN     =  6;
Message.SEARCH    =  7;

// No arguments => only need one instance.
Message.RESET_MESSAGE = new Message(Message.RESET);
Message.STOP_MESSAGE = new Message(Message.STOP);
Message.CONTINUE_MESSAGE = new Message(Message.CONTINUE);

function ScissorsWorker(scissorsURL) {
	this.worker = new Worker(scissorsURL);
	this.worker.enclosingScissorsWorker = this; // For onmessage proxy.
	
	this.width = -1;
	this.height = -1;
	
	this.working = false;
	this.processing = false; // Won't accept resultant data when false.
	
	this.gradient = null;
	this.parentPoints = null;
	
	this.curPoint = null;
	
	this.onmessage = null;
	this.onerror = function(event) {};
	this.onstatus = function(msg) {};
	this.ondata = function(data) {};
	
	this.worker.onmessage = function(event) {
		this.enclosingScissorsWorker._processMessage(event);
	};
	
	this.worker.onerror = function(event) {
		this.enclosingScissorsWorker.onerror(event);
	};
}

ScissorsWorker.prototype.setTraining = function(train) {
	this._postTrainMessage(train);
};

ScissorsWorker.prototype.setImageData = function(imageData) {
	this.width = imageData.width;
	this.height = imageData.height;
	
	this._postImageMessage(imageData);
};

ScissorsWorker.prototype.setPoint = function(p) {
	this.curPoint = p;
	this._resetParentPoints();
	this.processing = true;
	
	this._postPointMessage(p);
};

ScissorsWorker.prototype.hasPoint = function() {
	return this.getPoint() != null;
};

ScissorsWorker.prototype.getPoint = function() {
	return this.curPoint;
};

ScissorsWorker.prototype.getParentPoint = function(p) {
	return this.parentPoints[p.y][p.x];
};

ScissorsWorker.prototype.getPathFrom = function(p) {
	subpath = new Array();
	
	while (p) {
		subpath.push(new Point(p.x, p.y));
		p = this.getParentPoint(p);
	}
	
	return subpath;
}

ScissorsWorker.prototype.hasPathFor = function(p) {
	return !!this.getParentPoint(p);
}

ScissorsWorker.prototype.getParentInfo = function() {
	return this.parentPoints;
};

ScissorsWorker.prototype.stop = function() {
	this._postStopMessage();
	this.processing = false;
};

ScissorsWorker.prototype.resetTraining = function() {
	this._postResetMessage();
};

ScissorsWorker.prototype.isWorking = function() {
	return working;
};

ScissorsWorker.prototype.postMessage = function(event) {
	this.worker.postMessage(event);
};

ScissorsWorker.prototype._resetParentPoints = function() {
	this.parentPoints = new Array();
	
	for ( var i = 0; i < this.height; i++ ) {
		this.parentPoints[i] = new Array();
	}
};

ScissorsWorker.prototype._processMessage = function(event) {
	var data = event.data;
	
	switch (data.msgType) {
		case Message.RESULTS:
			this._processResultsMessage(data);
			break;
		case Message.STATUS:
			this._processStatusMessage(data);
			break;
		case Message.GRADIENT:
			this._processGradientMessage(data);
			break;
		case Message.WORKING:
			this._processWorkingMessage(data);
			break;
		default:
			this._processUnknownMessage(event);
	}
};

ScissorsWorker.prototype._processResultsMessage = function(data) {
	if ( !this.processing ) {
		return;
	}
	
	this._postContinueMessage(); // Pipe clear for next batch.
	
	var results = data.results;
	for ( var i = 0; i < results.length; i += 2 ) {
		var p = results[i]; var q = results[i+1];
		this.parentPoints[p.y][p.x] = q;
	}
	
	this.ondata(this.parentPoints);
};

ScissorsWorker.prototype._processGradientMessage = function(data) {
	this.gradient = data.gradient;
};

ScissorsWorker.prototype._processStatusMessage = function(data) {
	this.onstatus(data.status);
};

ScissorsWorker.prototype._processUnknownMessage = function(event) {
	if ( this.onmessage != null ) {
		this.onmessage(event);
	} else {
		throw new Error("Unknown message type: '" + event.data.msgType + "'");
	}
};

ScissorsWorker.prototype._processWorkingMessage = function(data) {
	this.working = data.working;
};

ScissorsWorker.prototype._postContinueMessage = function() {
	this.worker.postMessage(Message.CONTINUE_MESSAGE);
};

ScissorsWorker.prototype._postImageMessage = function(data) {
	var msg = new Message(Message.IMAGE);
	msg.imageData = data; // Chrome can only post entire ImageData object
	this.worker.postMessage(msg);
};

ScissorsWorker.prototype._postPointMessage = function(p) {
	var msg = new Message(Message.POINT);
	msg.point = p;
	this.worker.postMessage(msg);
};

ScissorsWorker.prototype._postResetMessage = function() {
	this.worker.postMessage(Message.RESET_MESSAGE);
};

ScissorsWorker.prototype._postStopMessage = function() {
	this.worker.postMessage(Message.STOP_MESSAGE);
};

ScissorsWorker.prototype._postTrainMessage = function(train) {
	var msg = new Message(Message.TRAIN);
	msg.train = train;
	this.worker.postMessage(msg);
};
