//@flow

import React from "react";
import {StyleSheet, Text, View, Dimensions} from "react-native";
import {PanGestureHandler, State} from "react-native-gesture-handler";
const {width, height} = Dimensions.get("window");
import Animated, {Adaptable, Easing} from "react-native-reanimated";
const {
	cond,
	eq,
	or,
	abs,
	add,
	spring,
	greaterThan,
	set,
	and,
	not,
	diff,
	neq,
	Value,
	sub,
	multiply,
	event,
	interpolate,
	Extrapolate,
	startClock,
	stopClock,
	clockRunning,
	block,
	timing,
	debug,
	Clock,
	divide,
	concat,
	defined,
	greaterOrEq
} = Animated;


function delay(clock, time, node, nodeBefore = 0) {
	const when = new Value();
	return block([
		cond(defined(when), 0, [set(when, add(clock, time))]),
		cond(greaterOrEq(clock, when), node, nodeBefore),
	]);
}

const runRotateTimer = (
	clock,
	gestureState,
	spinDuration = 2000,
	rotateDuration = 100
) => {
	const state = {
		finished: new Value(0),
		position: new Value(0),
		time: new Value(0),
		frameTime: new Value(0)
	};

	const config = {
		duration: new Value(spinDuration),
		toValue: new Value(-1),
		easing: Easing.linear
	};

	const restartAnimation = (
		toValue = 360,
		duration = 2000,
		resetPosition = true
	) => [
		// we stop
		stopClock(clock),
		set(state.finished, 0),
		resetPosition ? set(state.position, 0) : 1,
		set(state.time, 0),
		set(state.frameTime, 0),
		set(config.toValue, toValue),
		set(config.duration, duration),
		// and we restart
		startClock(clock)
	];

	const isNotDragging = and(
		neq(gestureState, State.ACTIVE),
		neq(gestureState, State.BEGAN)
	);

	const pendingPosition = () => cond(greaterThan(state.position, 180), 360, 0);

	const pendingRotate = () =>
		cond(
			greaterThan(state.position, 180),
			sub(360, state.position),
			state.position
		);

	// 180           - 1.0
	// pendingRotate - x
	const pendingDurationP = () => divide(pendingRotate(), 180);

	const pendingDuration = multiply(pendingDurationP(), rotateDuration);

	return block([
		cond(clockRunning(clock), 0, restartAnimation()),
		timing(clock, state, config),
		cond(
			and(eq(gestureState, State.BEGAN), eq(config.duration, spinDuration)),
			restartAnimation(
				debug("pendingPosition", pendingPosition()),
				debug("pendingDuration", pendingDuration),
				false
			)
		),
		cond(and(eq(state.finished, 1), isNotDragging), restartAnimation()),
		state.position
	]);
};

const runScaleTimer = (clock, gestureState, duration) => {
	const state = {
		finished: new Value(1),
		position: new Value(0),
		time: new Value(0),
		frameTime: new Value(0)
	};

	const config = {
		duration: duration,
		toValue: new Value(0),
		easing: Easing.linear
	};

	return block([
		cond(and(eq(gestureState, State.BEGAN), neq(config.toValue, 1)), [
			set(state.finished, 0),
			set(state.time, 0),
			set(state.frameTime, 0),
			set(config.toValue, 1),
			startClock(clock)
		]),
		cond(
			and(
				or(eq(gestureState, State.END), eq(gestureState, State.FAILED)),
				neq(config.toValue, 0)
			),
			[
				set(state.finished, 0),
				set(state.time, 0),
				set(state.frameTime, 0),
				set(config.toValue, 0),
				startClock(clock)
			]
		),
		timing(clock, state, config),
		// cond(eq(state.finished, 1), stopClock(clock)),
		interpolate(state.position, {
			inputRange: [0, 1],
			outputRange: [1, 1.3]
		})
	]);
};

function translateAnimation(gestureTranslation, gestureState) {
	const dragging = new Value(0);
	const start = new Value(0);
	const position = new Value(0);

	return cond(
		eq(gestureState, State.ACTIVE),
		[
			cond(dragging, 0, [set(dragging, 1), set(start, position)]),
			set(position, add(start, gestureTranslation))
		],
		[set(dragging, 0), position]
	);
}

function translateAnimationY(
	gestureTranslation,
	gestureState,
	duration = 1500,
	toValue = 450
) {
	const dragging = new Value(0);
	const start = new Value(0);
	const position = new Value(0);
	const clock = new Clock();

	const state = {
		finished: new Value(0),
		position: position,
		time: new Value(0),
		frameTime: new Value(0)
	};

	const config = {
		duration: new Value(duration),
		toValue: new Value(-1),
		easing: Easing.inOut(Easing.ease)
	};

	const isNotDragging = and(
		neq(gestureState, State.ACTIVE),
		neq(gestureState, State.BEGAN)
	);

	const isDragging = or(
		eq(gestureState, State.ACTIVE),
		eq(gestureState, State.BEGAN)
	);

	const delayed = new Value(0);

	const translation = translateAnimation(gestureTranslation, gestureState);

	return block([
		cond(clockRunning(clock), 0, [
			set(state.finished, 0),
			set(state.time, 0),
			set(state.position, 0),
			set(state.frameTime, 0),
			set(config.toValue, toValue),
			startClock(clock),
		]),
		timing(clock, state, config),
		debug("value", add(translation, state.position))
	])
}

type Props = {
	initialY: number,
	initialX: number,
	fallingDuration: number,
	onFall: ({x: number, y: number}) => void,
	children: ?any
};

export default class DraggingFallingReanimated extends React.Component<Props> {
	_transX: Animated.Value;
	_transY: Animated.Value;

	scale: Animated.Value;
	rotate: Animated.Value;

	_onGestureEvent: any;

	constructor(props: Props) {
		super(props);

		const gestureX = new Value(0);
		const gestureY = new Value(0);

		const state = new Value(-1);

		this._onGestureEvent = event([
			{
				nativeEvent: {
					translationX: gestureX,
					translationY: gestureY,
					state: state
				}
			}
		]);

		this._transX = translateAnimation(gestureX, state);
		this._transY = translateAnimationY(gestureY, state);

		this.scale = runScaleTimer(new Clock(), state, 200);
		this.rotate = runRotateTimer(new Clock(), state, 2000, 200);
	}

	render() {
		return (
			<PanGestureHandler
				maxPointers={1}
				onGestureEvent={this._onGestureEvent}
				onHandlerStateChange={this._onGestureEvent}
			>
				<Animated.View
					style={[
						{
							position: "absolute"
						},
						{
							transform: [
								{
									translateX: this._transX
								},
								{
									translateY: this._transY
								},
								{scaleX: this.scale},
								{scaleY: this.scale},
								{rotate: concat(this.rotate, "deg")}
							]
						}
					]}
				>
					{this.props.children}
				</Animated.View>
			</PanGestureHandler>
		);
	}
}