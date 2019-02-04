import * as THREE from 'three';
console.log('slicer');

THREE.Vector3.prototype.equals = function(v, tolerance) {
	if (tolerance === undefined) {
		return ((v.x === this.x) && (v.y === this.y) && (v.z === this.z));
	} else {
		return ((Math.abs(v.x - this.x) < tolerance) && (Math.abs(v.y - this.y) < tolerance) && (Math.abs(v.z - this.z) < tolerance));
	}
};

export default class Slicer{
	constructor(scene, obj, slicePlane) {
		if (obj.geometry.isBufferGeometry){
			let geom = new THREE.Geometry();
			obj.geometry = geom.fromBufferGeometry(obj.geometry);
		}
	const slicer = this;
	slicer.scene = scene;
	slicer.obj = obj;
	slicer.slicePlane = slicePlane;
	slicer.tolerance = 0.001;
	this.compute = this.compute.bind(this);
	this.reset = this.reset.bind(this);
	}

	reset(){
		const slicer = this;
		slicer.pointsOfIntersection = new THREE.Geometry();
		slicer.a = new THREE.Vector3();
		slicer.b = new THREE.Vector3();
		slicer.c = new THREE.Vector3();
		slicer.planePointA = new THREE.Vector3();
		slicer.planePointB = new THREE.Vector3();
		slicer.planePointC = new THREE.Vector3();
		slicer.lineAB = new THREE.Line3();
		slicer.lineBC = new THREE.Line3();
		slicer.lineCA = new THREE.Line3();
		slicer.pointOfIntersection = new THREE.Vector3();
	}

	compute(){
		const slicer = this;
		slicer.reset();
		const mathPlane = new THREE.Plane();
		slicer.slicePlane.localToWorld(slicer.planePointA.copy(slicer.slicePlane.geometry.vertices[slicer.slicePlane.geometry.faces[0].a]));
		slicer.slicePlane.localToWorld(slicer.planePointB.copy(slicer.slicePlane.geometry.vertices[slicer.slicePlane.geometry.faces[0].b]));
		slicer.slicePlane.localToWorld(slicer.planePointC.copy(slicer.slicePlane.geometry.vertices[slicer.slicePlane.geometry.faces[0].c]));
		mathPlane.setFromCoplanarPoints(slicer.planePointA, slicer.planePointB, slicer.planePointC);

		slicer.obj.geometry.faces.forEach(function(face, idx) {
			slicer.obj.localToWorld(slicer.a.copy(slicer.obj.geometry.vertices[face.a]));
			slicer.obj.localToWorld(slicer.b.copy(slicer.obj.geometry.vertices[face.b]));
			slicer.obj.localToWorld(slicer.c.copy(slicer.obj.geometry.vertices[face.c]));
			slicer.lineAB = new THREE.Line3(slicer.a, slicer.b);
			slicer.lineBC = new THREE.Line3(slicer.b, slicer.c);
			slicer.lineCA = new THREE.Line3(slicer.c, slicer.a);
			slicer.setPointOfIntersection(slicer.lineAB, mathPlane, idx);
			slicer.setPointOfIntersection(slicer.lineBC, mathPlane, idx);
			slicer.setPointOfIntersection(slicer.lineCA, mathPlane, idx);
		});

		let pointsMaterial = new THREE.PointsMaterial({
			size: .5,
			color: 0x00ff00
		});
		let points = new THREE.Points(slicer.pointsOfIntersection, pointsMaterial);
		slicer.scene.add(points);
		console.log(points);

		//var pairs = splitPairs(pointsOfIntersection.vertices);

		const contours = slicer.getContours(slicer.pointsOfIntersection.vertices, [], true);
		console.log("contours", contours);

		contours.forEach(cntr => {
			let cntrGeom = new THREE.Geometry();
			cntrGeom.vertices = cntr;
			let contour = new THREE.Line(cntrGeom, new THREE.LineBasicMaterial({
				color: Math.random() * 0xffffff //0x777777 + 0x777777
			}));
			slicer.scene.add(contour);
		});
	}

	setPointOfIntersection(line, plane, faceIdx) {
		const slicer = this;
		let dummy = new THREE.Vector3()
		slicer.pointOfIntersection = plane.intersectLine(line, dummy);
		if (this.pointOfIntersection) {
			let p = this.pointOfIntersection.clone();
			p.faceIndex = faceIdx;
			p.checked = false;
			this.pointsOfIntersection.vertices.push(p);
		};
	}


	getContours(points, contours, firstRun) {
		const slicer = this;
		console.log("firstRun:", firstRun);

		let contour = [];

		// find first line for the contour
		let firstPointIndex = 0;
		let secondPointIndex = 0;
		let firstPoint, secondPoint;
		for (let i = 0; i < points.length; i++) {
			if (points[i].checked == true) continue;
			firstPointIndex = i;
			firstPoint = points[firstPointIndex];
			firstPoint.checked = true;
			secondPointIndex = this.getPairIndex(firstPoint, firstPointIndex, points);
			secondPoint = points[secondPointIndex];
			secondPoint.checked = true;
			contour.push(firstPoint.clone());
			contour.push(secondPoint.clone());
			break;
		}

		contour = this.getContour(secondPoint, points, contour);
		contours.push(contour);
		let allChecked = 0;
		points.forEach(p => { allChecked += p.checked == true ? 1 : 0; });
		console.log("allChecked: ", allChecked == points.length);
		if (allChecked != points.length) { return this.getContours(points, contours, false); }
		return contours;
	}

	getContour(currentPoint, points, contour){
		const slicer = this;
			let p1Index = this.getNearestPointIndex(currentPoint, points);
			let p1 = points[p1Index];
			p1.checked = true;
			let p2Index = this.getPairIndex(p1, p1Index, points);
			let p2 = points[p2Index];
			p2.checked = true;
			let isClosed = p2.equals(contour[0], slicer.tolerance);
			if (!isClosed) {
				contour.push(p2.clone());
				return this.getContour(p2, points, contour);
			} else {
				contour.push(contour[0].clone());
				return contour;
			}
		}

	getNearestPointIndex(point, points){
		const slicer = this;
		let index = 0;
		for (let i = 0; i < points.length; i++){
			let p = points[i];
			if (p.checked == false && p.equals(point, slicer.tolerance)){
				index = i;
				break;
			}
		}
		return index;
	}

	getPairIndex(point, pointIndex, points) {
		const slicer = this;
			let index = 0;
			for (let i = 0; i < points.length; i++) {
				let p = points[i];
				if (i != pointIndex && p.checked == false && p.faceIndex == point.faceIndex) {
					index = i;
					break;
				}
			}
			return index;
		}
}
